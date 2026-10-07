import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/persistence/prisma";
import { auth } from "./auth";
import { writeAuthAudit } from "./audit";
import {
  ADMIN_PROFILES,
  APP_ROLES,
  TEMPORARY_PASSWORD_PURPOSES,
  AuthError,
  type AdminProfile,
  type AppRole,
  type AuthActor,
  type AuthenticatedSession,
} from "./types";
import { isTemporaryPasswordExpired } from "./trial-policy";

function optionalDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function toActor(user: Record<string, unknown>): AuthActor | null {
  const role = user.role;
  const status = user.status;
  const locale = user.locale;
  if (
    typeof user.id !== "string" ||
    typeof user.email !== "string" ||
    typeof user.name !== "string" ||
    !APP_ROLES.includes(role as AppRole) ||
    (status !== "active" && status !== "suspended") ||
    (locale !== "en" && locale !== "es")
  ) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: typeof user.image === "string" ? user.image : null,
    role: role as AppRole,
    adminProfile:
      typeof user.adminProfile === "string" &&
      ADMIN_PROFILES.includes(user.adminProfile as AdminProfile)
        ? (user.adminProfile as AdminProfile)
        : null,
    status,
    locale,
    temporaryPasswordChangeRequired: user.temporaryPasswordChangeRequired === true,
    temporaryPasswordExpiresAt: optionalDate(user.temporaryPasswordExpiresAt),
    temporaryPasswordPurpose:
      typeof user.temporaryPasswordPurpose === "string" &&
      TEMPORARY_PASSWORD_PURPOSES.includes(
        user.temporaryPasswordPurpose as (typeof TEMPORARY_PASSWORD_PURPOSES)[number],
      )
        ? (user.temporaryPasswordPurpose as (typeof TEMPORARY_PASSWORD_PURPOSES)[number])
        : null,
    trialActivatedAt: optionalDate(user.trialActivatedAt),
    trialExpiresAt: optionalDate(user.trialExpiresAt),
    initialCreditAllocation:
      typeof user.initialCreditAllocation === "number"
        ? user.initialCreditAllocation
        : 10,
    twoFactorEnabled: user.twoFactorEnabled === true,
    twoFactorVerified: user.twoFactorVerified === true,
  };
}

export async function getCurrentSession(
  requestHeaders?: Headers,
): Promise<AuthenticatedSession | null> {
  const result = await auth.api.getSession({
    headers: requestHeaders ?? (await headers()),
  });
  if (!result) return null;

  const sessionUserId = (result.user as { id?: unknown }).id;
  if (typeof sessionUserId !== "string") return null;
  const readyUser = await prisma.user.findFirst({
    where: {
      id: sessionUserId,
      accounts: { some: { providerId: "credential", password: { not: null } } },
      workspace: { is: { lifecycle: "ACTIVE" } },
    },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      adminProfile: true,
      status: true,
      locale: true,
      temporaryPasswordChangeRequired: true,
      temporaryPasswordExpiresAt: true,
      temporaryPasswordPurpose: true,
      trialActivatedAt: true,
      trialExpiresAt: true,
      initialCreditAllocation: true,
      twoFactorEnabled: true,
      twoFactor: { select: { verified: true } },
    },
  });
  if (!readyUser) return null;
  const actor = toActor({
    ...readyUser,
    twoFactorVerified: readyUser.twoFactor?.verified === true,
  } as unknown as Record<string, unknown>);
  if (!actor) return null;
  return { session: result.session, user: actor } as AuthenticatedSession;
}

export async function requireActiveSession(
  requestHeaders?: Headers,
): Promise<AuthenticatedSession> {
  const session = await getCurrentSession(requestHeaders);
  if (!session) throw new AuthError("UNAUTHENTICATED");
  if (session.user.status !== "active") throw new AuthError("ACCOUNT_INACTIVE");
  if (session.user.temporaryPasswordChangeRequired) {
    throw new AuthError(
      isTemporaryPasswordExpired(session.user.temporaryPasswordExpiresAt)
        ? "TEMPORARY_PASSWORD_EXPIRED"
        : "TEMPORARY_PASSWORD_CHANGE_REQUIRED",
    );
  }
  if (
    session.user.role === "platform_admin" &&
    (!session.user.twoFactorEnabled || !session.user.twoFactorVerified)
  ) {
    await writeAuthAudit({
      action: "auth.mfa.pending_denied",
      actorUserId: session.user.id,
      targetUserId: session.user.id,
      outcome: "DENIED",
      safeMetadata: { reason: "ADMIN_MFA_ENROLLMENT_REQUIRED" },
    });
    throw new AuthError("ADMIN_MFA_ENROLLMENT_REQUIRED");
  }
  return session;
}

export async function requireRoles(
  roles: readonly AppRole[],
  requestHeaders?: Headers,
): Promise<AuthenticatedSession> {
  const session = await requireActiveSession(requestHeaders);
  if (!roles.includes(session.user.role)) throw new AuthError("FORBIDDEN");
  return session;
}

export async function resolveCurrentWorkspace(requestHeaders?: Headers) {
  const session = await requireActiveSession(requestHeaders);
  const workspace = await prisma.workspace.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true, ownerId: true, lifecycle: true },
  });
  if (!workspace || workspace.lifecycle !== "ACTIVE") {
    throw new AuthError("ACCOUNT_INACTIVE");
  }
  return { session, workspace };
}
