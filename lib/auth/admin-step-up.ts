import "server-only";

import { headers } from "next/headers";
import { isAPIError } from "better-auth/api";
import { prisma } from "@/lib/persistence/prisma";
import { auth } from "./auth";
import { requireActiveSession } from "./session";
import { AuthError, type AuthenticatedSession } from "./types";

export const ADMIN_STEP_UP_MAX_AGE_SECONDS = 15 * 60;

export type AdminStepUpFailureCode =
  | "UNAUTHENTICATED"
  | "ACCOUNT_INACTIVE"
  | "ADMIN_MFA_ENROLLMENT_REQUIRED"
  | "ADMIN_PROFILE_INCONSISTENT"
  | "RECENT_SESSION_REQUIRED"
  | "INVALID_CURRENT_PASSWORD"
  | "INVALID_TWO_FACTOR_CODE"
  | "MFA_TEMPORARILY_LOCKED"
  | "STATE_CHANGED"
  | "INTERNAL_ERROR";

export type AdminStepUpResult =
  | {
      success: true;
      session: AuthenticatedSession;
      requestHeaders: Headers;
    }
  | {
      success: false;
      code: AdminStepUpFailureCode;
      actorUserId: string | null;
    };

function apiErrorCode(error: unknown): string | null {
  if (!isAPIError(error)) return null;
  const body = error.body as { code?: unknown } | undefined;
  return typeof body?.code === "string" ? body.code : null;
}

function mapFailure(error: unknown): AdminStepUpFailureCode {
  if (error instanceof AuthError) {
    if (
      error.code === "UNAUTHENTICATED" ||
      error.code === "ACCOUNT_INACTIVE" ||
      error.code === "ADMIN_MFA_ENROLLMENT_REQUIRED"
    ) {
      return error.code;
    }
    return "STATE_CHANGED";
  }
  switch (apiErrorCode(error)) {
    case "INVALID_PASSWORD":
      return "INVALID_CURRENT_PASSWORD";
    case "INVALID_CODE":
      return "INVALID_TWO_FACTOR_CODE";
    case "ACCOUNT_TEMPORARILY_LOCKED":
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
      return "MFA_TEMPORARILY_LOCKED";
    case "INVALID_TWO_FACTOR_COOKIE":
    case "TOTP_NOT_ENABLED":
      return "STATE_CHANGED";
    default:
      return "INTERNAL_ERROR";
  }
}

function isDefinitiveAdministrator(session: AuthenticatedSession): boolean {
  return (
    session.user.role === "platform_admin" &&
    (session.user.adminProfile === "owner" || session.user.adminProfile === "operator") &&
    session.user.status === "active" &&
    session.user.twoFactorEnabled &&
    session.user.twoFactorVerified &&
    !session.user.temporaryPasswordChangeRequired
  );
}

/**
 * Revalidates both current credentials with Better Auth 1.7.3. `verifyTOTP`
 * uses the existing definitive session and therefore must not mint a second
 * reusable session. The explicit before/after fence fails closed if that
 * installed-version contract changes.
 */
export async function verifyAdminStepUp(input: {
  password: string;
  totpCode: string;
}): Promise<AdminStepUpResult> {
  let actorUserId: string | null = null;
  let beforeSessionIds: string[] = [];
  try {
    const requestHeaders = await headers();
    const session = await requireActiveSession(requestHeaders);
    actorUserId = session.user.id;
    if (!isDefinitiveAdministrator(session)) {
      return { success: false, code: "ADMIN_PROFILE_INCONSISTENT", actorUserId };
    }
    const ageMs = Date.now() - session.session.createdAt.getTime();
    if (ageMs < 0 || ageMs > ADMIN_STEP_UP_MAX_AGE_SECONDS * 1_000) {
      return { success: false, code: "RECENT_SESSION_REQUIRED", actorUserId };
    }

    beforeSessionIds = (
      await prisma.session.findMany({
        where: { userId: actorUserId },
        select: { id: true },
        orderBy: { id: "asc" },
      })
    ).map(({ id }) => id);
    if (!beforeSessionIds.includes(session.session.id)) {
      return { success: false, code: "STATE_CHANGED", actorUserId };
    }

    await auth.api.verifyPassword({
      headers: requestHeaders,
      body: { password: input.password },
    });
    await auth.api.verifyTOTP({
      headers: requestHeaders,
      body: { code: input.totpCode, trustDevice: false },
    });

    const afterSessionIds = (
      await prisma.session.findMany({
        where: { userId: actorUserId },
        select: { id: true },
        orderBy: { id: "asc" },
      })
    ).map(({ id }) => id);
    const unexpected = afterSessionIds.filter((id) => !beforeSessionIds.includes(id));
    if (unexpected.length > 0) {
      await prisma.session.deleteMany({ where: { id: { in: unexpected } } });
      return { success: false, code: "INTERNAL_ERROR", actorUserId };
    }
    if (!afterSessionIds.includes(session.session.id)) {
      return { success: false, code: "STATE_CHANGED", actorUserId };
    }

    return { success: true, session, requestHeaders };
  } catch (error) {
    return { success: false, code: mapFailure(error), actorUserId };
  }
}
