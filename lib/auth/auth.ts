import "server-only";

import { createHash } from "node:crypto";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { prisma } from "@/lib/persistence/prisma";
import { authAccessControl, authRoles } from "./access-control";
import { writeAuthAudit } from "./audit";

function requiredAuthEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured before using authentication.`);
  return value;
}

const authSecret = requiredAuthEnvironment("BETTER_AUTH_SECRET");
if (authSecret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
}

const authBaseUrl = requiredAuthEnvironment("BETTER_AUTH_URL");
const parsedAuthBaseUrl = new URL(authBaseUrl);
if (parsedAuthBaseUrl.protocol !== "http:" && parsedAuthBaseUrl.protocol !== "https:") {
  throw new Error("BETTER_AUTH_URL must use http or https.");
}

function trustedOrigins(): string[] {
  return [
    authBaseUrl,
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? []),
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin));
}

const auditedFailureActions = {
  "/sign-in/email": "auth.login",
  "/sign-up/email": "user.create",
  "/admin/create-user": "user.create",
  "/admin/update-user": "user.update",
  "/admin/set-role": "user.role_change",
} as const;

function loginCorrelationId(sessionToken: string): string {
  return `auth.login:${createHash("sha256").update(sessionToken).digest("hex")}`;
}

const definitiveTwoFactorPaths = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
]);

function hookPath(context: { path?: string } | null): string | null {
  return typeof context?.path === "string" ? context.path : null;
}

function isProvisionalOrRotatedSession(
  context: { path?: string } | null,
  user: {
    role: string;
    twoFactorEnabled: boolean;
    twoFactor: { verified: boolean } | null;
  },
): boolean {
  const path = hookPath(context);
  if (path === "/sign-in/email" && user.role === "platform_admin") {
    return true;
  }
  // Both enrollment rotation and definitive challenge sessions are audited by
  // the application MFA service only after it reloads current authorization.
  return definitiveTwoFactorPaths.has(path ?? "");
}

async function sessionAuditSubject(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      adminProfile: true,
      twoFactorEnabled: true,
      twoFactor: { select: { verified: true } },
    },
  });
}

export const auth = betterAuth({
  appName: "Conversation Processing Demo",
  baseURL: authBaseUrl,
  secret: authSecret,
  trustedOrigins: trustedOrigins(),
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    cookieCache: { enabled: false },
  },
  user: {
    additionalFields: {
      adminProfile: {
        type: "string",
        required: false,
        input: false,
      },
      status: {
        type: "string",
        required: true,
        defaultValue: "active",
        input: false,
      },
      locale: {
        type: "string",
        required: true,
        defaultValue: "en",
        input: false,
      },
      temporaryPasswordChangeRequired: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: false,
      },
      temporaryPasswordExpiresAt: {
        type: "date",
        required: false,
        input: false,
      },
      temporaryPasswordPurpose: {
        type: "string",
        required: false,
        input: false,
      },
      trialActivatedAt: {
        type: "date",
        required: false,
        input: false,
      },
      trialExpiresAt: {
        type: "date",
        required: false,
        input: false,
      },
      initialCreditAllocation: {
        type: "number",
        required: true,
        defaultValue: 10,
        input: false,
      },
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
  },
  hooks: {
    after: createAuthMiddleware(async (context) => {
      // Trusted in-process API calls are audited by their application service.
      // This hook covers failed requests reaching the public Better Auth handler.
      if (!context.request && !context.headers) return;
      const action = auditedFailureActions[
        context.path as keyof typeof auditedFailureActions
      ];
      const returned = context.context.returned;
      if (!action || !isAPIError(returned)) return;

      await writeAuthAudit({
        action,
        actorUserId: context.context.session?.user.id ?? null,
        outcome:
          returned.statusCode === 401 || returned.statusCode === 403
            ? "DENIED"
            : "FAILED",
        safeMetadata: {
          endpoint: context.path,
          statusCode: returned.statusCode,
        },
      });
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          if (!context?.context.session) return { data: user };
          return {
            data: {
              ...user,
              role: "trial_user",
              adminProfile: null,
              status: "active",
              emailVerified: true,
              temporaryPasswordChangeRequired: false,
              temporaryPasswordExpiresAt: null,
              temporaryPasswordPurpose: null,
              trialActivatedAt: null,
              trialExpiresAt: null,
            },
          };
        },
        after: async (user) => {
          try {
            await prisma.workspace.upsert({
              where: { ownerId: user.id },
              create: { ownerId: user.id },
              update: {},
            });
          } catch (error) {
            try {
              await prisma.user.delete({ where: { id: user.id } });
            } catch (compensationError) {
              console.error("Identity hook compensation failed", {
                errorName: compensationError instanceof Error ? compensationError.name : "UnknownError",
              });
            }
            throw error;
          }
        },
      },
      update: {
        before: async (data, context) => {
          const requestedRole = (data as { role?: unknown }).role;
          // Role changes go through the serializable application service so
          // self-demotion and the last-admin invariant cannot be raced.
          if (requestedRole === "trial_user" || requestedRole === "platform_admin") {
            return false;
          }
          const requestedTwoFactor = (data as { twoFactorEnabled?: unknown })
            .twoFactorEnabled;
          if (requestedTwoFactor !== undefined) {
            // H2C-2a never permits disabling MFA. Enabling is owned exclusively
            // by the verified TOTP transition inside Better Auth.
            if (
              requestedTwoFactor !== true ||
              hookPath(context) !== "/two-factor/verify-totp"
            ) {
              return false;
            }
          }
          return { data };
        },
      },
    },
    session: {
      create: {
        before: async (session, context) => {
          const readyUser = await prisma.user.findFirst({
            where: {
              id: session.userId,
              status: "active",
              accounts: {
                some: { providerId: "credential", password: { not: null } },
              },
              workspace: { is: { lifecycle: "ACTIVE" } },
            },
            select: {
              id: true,
              role: true,
              adminProfile: true,
              twoFactorEnabled: true,
              twoFactor: { select: { verified: true } },
            },
          });
          if (!readyUser) return false;
          if (
            readyUser.role === "platform_admin" &&
            readyUser.adminProfile !== "owner" &&
            readyUser.adminProfile !== "operator"
          ) {
            return false;
          }
          if (
            readyUser.role === "platform_admin" &&
            readyUser.twoFactorEnabled &&
            readyUser.twoFactor?.verified !== true &&
            hookPath(context) !== "/two-factor/verify-totp"
          ) {
            return false;
          }
          if (isProvisionalOrRotatedSession(context, readyUser)) {
            return { data: session };
          }
          await writeAuthAudit({
            action: "auth.login",
            actorUserId: session.userId,
            outcome: "ALLOWED",
            correlationId: loginCorrelationId(session.token),
          });
          return { data: session };
        },
        after: async (session, context) => {
          const subject = await sessionAuditSubject(session.userId);
          if (!subject || isProvisionalOrRotatedSession(context, subject)) return;
          await writeAuthAudit({
            action: "auth.login",
            actorUserId: session.userId,
            outcome: "SUCCEEDED",
            correlationId: loginCorrelationId(session.token),
          });
        },
      },
      delete: {
        before: async (session, context) => {
          const path = hookPath(context);
          if (
            path === "/sign-in/email" ||
            definitiveTwoFactorPaths.has(path ?? "")
          ) {
            return true;
          }
          await writeAuthAudit({
            action: "auth.logout",
            actorUserId: session.userId,
            outcome: "ALLOWED",
            correlationId: `auth.logout:${session.id}`,
          });
          return true;
        },
        after: async (session, context) => {
          const path = hookPath(context);
          if (
            path === "/sign-in/email" ||
            definitiveTwoFactorPaths.has(path ?? "")
          ) {
            return;
          }
          await writeAuthAudit({
            action: "auth.logout",
            actorUserId: session.userId,
            outcome: "SUCCEEDED",
            correlationId: `auth.logout:${session.id}`,
          });
        },
      },
    },
  },
  plugins: [
    admin({
      ac: authAccessControl,
      roles: authRoles,
      defaultRole: "trial_user",
      adminRoles: ["platform_admin"],
    }),
    twoFactor({
      issuer: "Conversation Processing Demo",
      skipVerificationOnEnable: false,
      allowPasswordless: false,
      twoFactorCookieMaxAge: 600,
      trustDeviceMaxAge: 0,
      totpOptions: {
        digits: 6,
        period: 30,
      },
      backupCodeOptions: {
        storeBackupCodes: "encrypted",
      },
      accountLockout: {
        enabled: true,
        maxFailedAttempts: 5,
        durationSeconds: 900,
      },
    }),
    // Required for server actions that complete enrollment/challenge and need
    // Better Auth's rotated session cookie to reach the browser.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
