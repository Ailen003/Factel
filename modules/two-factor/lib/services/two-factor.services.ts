import "server-only";

import { headers } from "next/headers";
import { isAPIError } from "better-auth/api";
import { prisma } from "@/lib/persistence/prisma";
import { auth } from "@/lib/auth/auth";
import { writeAuthAudit } from "@/lib/auth/audit";
import { tryAcquireCredentialMutationLock } from "@/lib/auth/credential-mutation-lock";
import { getSafeReturnTo } from "@/lib/auth/route-access";
import { getCurrentSession } from "@/lib/auth/session";
import type { ServiceResponse } from "@/lib/api-responses";
import type {
  BeginTwoFactorEnrollmentInput,
  RegenerateTwoFactorBackupCodesInput,
  VerifyTwoFactorBackupChallengeInput,
  VerifyTwoFactorEnrollmentInput,
  VerifyTwoFactorTotpChallengeInput,
} from "../schemas";
import type {
  TwoFactorBackupCodesData,
  TwoFactorChallengeData,
  TwoFactorEnrollmentCompleteData,
  TwoFactorEnrollmentData,
  TwoFactorStatus,
} from "../types";

const RECENT_SESSION_SECONDS = 15 * 60;

type TwoFactorFailure = {
  success: false;
  error: { code: string; message: string };
};

function failure(code: string, message: string): TwoFactorFailure {
  return { success: false, error: { code, message } };
}

function apiErrorCode(error: unknown): string | null {
  if (!isAPIError(error)) return null;
  const body = error.body as { code?: unknown } | undefined;
  return typeof body?.code === "string" ? body.code : null;
}

function safeFailure(error: unknown): TwoFactorFailure {
  switch (apiErrorCode(error)) {
    case "INVALID_PASSWORD":
      return failure("INVALID_CURRENT_PASSWORD", "Current password is invalid");
    case "INVALID_CODE":
    case "INVALID_BACKUP_CODE":
      return failure("INVALID_TWO_FACTOR_CODE", "The verification code is invalid");
    case "ACCOUNT_TEMPORARILY_LOCKED":
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
      return failure("MFA_TEMPORARILY_LOCKED", "Verification is temporarily unavailable");
    case "INVALID_TWO_FACTOR_COOKIE":
      return failure("MFA_CHALLENGE_EXPIRED", "Restart sign in to continue");
    case "TOTP_ALREADY_ENABLED":
      return failure("MFA_ALREADY_ENABLED", "Two-factor authentication is already enabled");
    default:
      return failure("INTERNAL_ERROR", "Unable to complete two-factor authentication");
  }
}

function logUnexpected(operation: string, error: unknown): void {
  console.error("Two-factor operation failed", {
    operation,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
}

function validAdminProfile(value: unknown): value is "owner" | "operator" {
  return value === "owner" || value === "operator";
}

async function loadAdminMfaState(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      adminProfile: true,
      status: true,
      temporaryPasswordChangeRequired: true,
      twoFactorEnabled: true,
      twoFactor: {
        select: { id: true, verified: true, lockedUntil: true },
      },
      accounts: {
        where: { providerId: "credential", password: { not: null } },
        select: { id: true },
      },
      workspace: { select: { lifecycle: true } },
    },
  });
}

function isCurrentAdmin(state: Awaited<ReturnType<typeof loadAdminMfaState>>): boolean {
  return Boolean(
    state &&
      state.role === "platform_admin" &&
      validAdminProfile(state.adminProfile) &&
      state.status === "active" &&
      !state.temporaryPasswordChangeRequired &&
      state.accounts.length > 0 &&
      state.workspace?.lifecycle === "ACTIVE",
  );
}

async function enrollmentSession() {
  const requestHeaders = await headers();
  const session = await getCurrentSession(requestHeaders);
  if (!session) return { ok: false, error: failure("UNAUTHENTICATED", "Authentication required") } as const;
  if (session.user.status !== "active") {
    return { ok: false, error: failure("ACCOUNT_INACTIVE", "Account is inactive") } as const;
  }
  if (session.user.temporaryPasswordChangeRequired) {
    return {
      ok: false,
      error: failure(
        "TEMPORARY_PASSWORD_CHANGE_REQUIRED",
        "Complete the required password replacement first",
      ),
    } as const;
  }
  if (session.user.role !== "platform_admin" || !validAdminProfile(session.user.adminProfile)) {
    return { ok: false, error: failure("OPERATION_NOT_ALLOWED", "Operation is not available") } as const;
  }
  const state = await loadAdminMfaState(session.user.id);
  if (!isCurrentAdmin(state)) {
    return { ok: false, error: failure("STATE_CHANGED", "Account state changed; sign in again") } as const;
  }
  return { ok: true, session, state: state!, requestHeaders } as const;
}

async function safeAudit(
  input: Parameters<typeof writeAuthAudit>[0],
): Promise<boolean> {
  try {
    await writeAuthAudit(input);
    return true;
  } catch (error) {
    logUnexpected("audit", error);
    return false;
  }
}

async function deleteSessionToken(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { token } });
}

export async function getTwoFactorStatus(): Promise<ServiceResponse<TwoFactorStatus>> {
  try {
    const requestHeaders = await headers();
    const session = await getCurrentSession(requestHeaders);
    if (!session) return failure("UNAUTHENTICATED", "Authentication required");
    if (session.user.status !== "active") return failure("ACCOUNT_INACTIVE", "Account is inactive");
    if (session.user.role !== "platform_admin" || !validAdminProfile(session.user.adminProfile)) {
      return failure("OPERATION_NOT_ALLOWED", "Operation is not available");
    }
    if (session.user.temporaryPasswordChangeRequired) {
      return { success: true, data: { status: "password-change-required" } };
    }
    if (session.user.twoFactorEnabled === session.user.twoFactorVerified) {
      return {
        success: true,
        data: { status: session.user.twoFactorEnabled ? "enabled" : "enrollment-required" },
      };
    }
    return failure("MFA_STATE_INCONSISTENT", "Two-factor state requires review");
  } catch (error) {
    logUnexpected("status", error);
    return failure("INTERNAL_ERROR", "Unable to load two-factor status");
  }
}

export async function beginTwoFactorEnrollment(
  input: BeginTwoFactorEnrollmentInput,
): Promise<ServiceResponse<TwoFactorEnrollmentData>> {
  let actorUserId: string | null = null;
  let enrollmentCreated = false;
  let lock: Awaited<ReturnType<typeof tryAcquireCredentialMutationLock>> = null;
  try {
    const context = await enrollmentSession();
    if (!context.ok) return context.error;
    actorUserId = context.session.user.id;
    if (context.state.twoFactorEnabled || context.state.twoFactor?.verified) {
      return failure("MFA_ALREADY_ENABLED", "Two-factor authentication is already enabled");
    }
    lock = await tryAcquireCredentialMutationLock(actorUserId);
    if (!lock) return failure("CONFLICT", "Another credential operation is in progress");

    const result = await auth.api.enableTwoFactor({
      headers: context.requestHeaders,
      body: { password: input.password, method: "totp" },
    });
    enrollmentCreated = true;
    if (result.method !== "totp") throw new Error("Unexpected two-factor method");
    const parsed = new URL(result.totpURI);
    const manualSecret = parsed.searchParams.get("secret");
    if (!manualSecret) throw new Error("Missing TOTP secret in enrollment URI");

    if (!await safeAudit({
      action: "auth.mfa.enrollment_begin",
      actorUserId,
      targetUserId: actorUserId,
      outcome: "SUCCEEDED",
    })) {
      await prisma.twoFactor.deleteMany({ where: { userId: actorUserId, verified: false } });
      return failure("INTERNAL_ERROR", "Unable to begin two-factor enrollment");
    }
    return {
      success: true,
      data: { totpURI: result.totpURI, manualSecret, backupCodes: result.backupCodes },
    };
  } catch (error) {
    if (enrollmentCreated && actorUserId) {
      await prisma.twoFactor.deleteMany({
        where: { userId: actorUserId, verified: false },
      }).catch((cleanupError) => logUnexpected("enrollment-cleanup", cleanupError));
    }
    const mapped = safeFailure(error);
    await safeAudit({
      action: "auth.mfa.enrollment_rejected",
      actorUserId,
      targetUserId: actorUserId,
      outcome: mapped.error.code === "INVALID_CURRENT_PASSWORD" ? "DENIED" : "FAILED",
      safeMetadata: { reason: mapped.error.code },
    });
    if (mapped.error.code === "INTERNAL_ERROR") logUnexpected("begin-enrollment", error);
    return mapped;
  } finally {
    await lock?.release().catch((error) => logUnexpected("enrollment-lock-release", error));
  }
}

export async function verifyTwoFactorEnrollment(
  input: VerifyTwoFactorEnrollmentInput,
): Promise<ServiceResponse<TwoFactorEnrollmentCompleteData>> {
  let actorUserId: string | null = null;
  let createdSessionId: string | undefined;
  let verificationAccepted = false;
  let lock: Awaited<ReturnType<typeof tryAcquireCredentialMutationLock>> = null;
  try {
    const context = await enrollmentSession();
    if (!context.ok) return context.error;
    actorUserId = context.session.user.id;
    if (context.state.twoFactorEnabled || context.state.twoFactor?.verified !== false) {
      return failure("MFA_ENROLLMENT_NOT_PENDING", "Begin enrollment before verification");
    }
    lock = await tryAcquireCredentialMutationLock(actorUserId);
    if (!lock) return failure("CONFLICT", "Another credential operation is in progress");

    const verificationStartedAt = new Date(Date.now() - 1_000);
    await auth.api.verifyTOTP({
      headers: context.requestHeaders,
      body: { code: input.code, trustDevice: false },
    });
    verificationAccepted = true;
    const replacementSessions = await prisma.session.findMany({
      where: {
        userId: actorUserId,
        id: { not: context.session.session.id },
        createdAt: { gte: verificationStartedAt },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
      take: 2,
    });
    if (replacementSessions.length !== 1) {
      throw new Error("Unable to identify the replacement enrollment session");
    }
    createdSessionId = replacementSessions[0].id;
    const current = await loadAdminMfaState(actorUserId);
    if (!isCurrentAdmin(current) || !current?.twoFactorEnabled || !current.twoFactor?.verified) {
      await prisma.session.deleteMany({ where: { id: createdSessionId } });
      return failure("STATE_CHANGED", "Account state changed; sign in again");
    }

    const revokedSessions = (
      await prisma.session.deleteMany({
        where: { userId: actorUserId, id: { not: createdSessionId } },
      })
    ).count;
    const correlationId = crypto.randomUUID();
    if (!await safeAudit({
      action: "auth.mfa.enrollment_complete",
      actorUserId,
      targetUserId: actorUserId,
      outcome: "SUCCEEDED",
      correlationId,
      safeMetadata: { revokedSessions },
    })) {
      await prisma.session.deleteMany({ where: { id: createdSessionId } });
      return failure("INTERNAL_ERROR", "Two-factor enrollment completed; sign in again");
    }
    if (!await safeAudit({
      action: "auth.login",
      actorUserId,
      outcome: "SUCCEEDED",
      correlationId,
      safeMetadata: { secondFactor: "totp-enrollment" },
    })) {
      await prisma.session.deleteMany({ where: { id: createdSessionId } });
      return failure("INTERNAL_ERROR", "Two-factor enrollment completed; sign in again");
    }
    return { success: true, data: { revokedSessions } };
  } catch (error) {
    if (verificationAccepted && actorUserId) {
      await prisma.session.deleteMany({ where: { userId: actorUserId } })
        .catch((cleanupError) => logUnexpected("enrollment-session-cleanup", cleanupError));
    }
    const mapped = safeFailure(error);
    await safeAudit({
      action: "auth.mfa.enrollment_rejected",
      actorUserId,
      targetUserId: actorUserId,
      outcome: mapped.error.code === "INVALID_TWO_FACTOR_CODE" ? "DENIED" : "FAILED",
      safeMetadata: { reason: mapped.error.code },
    });
    if (mapped.error.code === "INTERNAL_ERROR") logUnexpected("verify-enrollment", error);
    return mapped;
  } finally {
    await lock?.release().catch((error) => logUnexpected("enrollment-lock-release", error));
  }
}

async function verifyChallenge(
  factor: "totp" | "backup",
  input: VerifyTwoFactorTotpChallengeInput | VerifyTwoFactorBackupChallengeInput,
): Promise<ServiceResponse<TwoFactorChallengeData>> {
  let createdToken: string | undefined;
  try {
    const requestHeaders = await headers();
    if (await getCurrentSession(requestHeaders)) {
      await safeAudit({
        action: "auth.mfa.bypass_attempted",
        outcome: "DENIED",
        safeMetadata: { reason: "DEFINITIVE_SESSION_PRESENT" },
      });
      return failure("OPERATION_NOT_ALLOWED", "Restart sign in to continue");
    }
    const result = factor === "totp"
      ? await auth.api.verifyTOTP({
          headers: requestHeaders,
          body: { code: input.code, trustDevice: false },
        })
      : await auth.api.verifyBackupCode({
          headers: requestHeaders,
          body: { code: input.code, trustDevice: false, disableSession: false },
        });
    createdToken = result.token;
    const userId = result.user.id;
    const current = await loadAdminMfaState(userId);
    if (!isCurrentAdmin(current) || !current?.twoFactorEnabled || !current.twoFactor?.verified) {
      await deleteSessionToken(createdToken);
      await safeAudit({
        action: "auth.mfa.bypass_attempted",
        actorUserId: userId,
        targetUserId: userId,
        outcome: "DENIED",
        safeMetadata: { reason: "STATE_CHANGED" },
      });
      return failure("STATE_CHANGED", "Account state changed; restart sign in");
    }

    const correlationId = crypto.randomUUID();
    const auditInputs: Array<Parameters<typeof writeAuthAudit>[0]> = [
      {
        action: "auth.mfa.challenge_succeeded",
        actorUserId: userId,
        targetUserId: userId,
        outcome: "SUCCEEDED",
        correlationId,
        safeMetadata: { factor },
      },
    ];
    if (factor === "backup") {
      auditInputs.splice(1, 0, {
        action: "auth.mfa.backup_code_used",
        actorUserId: userId,
        targetUserId: userId,
        outcome: "SUCCEEDED",
        correlationId,
      });
    }
    auditInputs.push({
      action: "auth.login",
      actorUserId: userId,
      outcome: "SUCCEEDED",
      correlationId,
      safeMetadata: { secondFactor: factor },
    });
    for (const auditInput of auditInputs) {
      if (!await safeAudit(auditInput)) {
        await deleteSessionToken(createdToken);
        return failure("INTERNAL_ERROR", "Unable to complete sign in");
      }
    }
    return {
      success: true,
      data: { returnTo: getSafeReturnTo(input.returnTo, "platform_admin") },
    };
  } catch (error) {
    await deleteSessionToken(createdToken)
      .catch((cleanupError) => logUnexpected("challenge-session-cleanup", cleanupError));
    const mapped = safeFailure(error);
    const locked = mapped.error.code === "MFA_TEMPORARILY_LOCKED";
    await safeAudit({
      action: locked ? "auth.mfa.challenge_locked" : "auth.mfa.challenge_rejected",
      outcome: "DENIED",
      safeMetadata: { factor, reason: mapped.error.code },
    });
    if (mapped.error.code === "INTERNAL_ERROR") logUnexpected("verify-challenge", error);
    return mapped;
  }
}

export function verifyTwoFactorTotpChallenge(
  input: VerifyTwoFactorTotpChallengeInput,
): Promise<ServiceResponse<TwoFactorChallengeData>> {
  return verifyChallenge("totp", input);
}

export function verifyTwoFactorBackupChallenge(
  input: VerifyTwoFactorBackupChallengeInput,
): Promise<ServiceResponse<TwoFactorChallengeData>> {
  return verifyChallenge("backup", input);
}

export async function regenerateTwoFactorBackupCodes(
  input: RegenerateTwoFactorBackupCodesInput,
): Promise<ServiceResponse<TwoFactorBackupCodesData>> {
  let actorUserId: string | null = null;
  let lock: Awaited<ReturnType<typeof tryAcquireCredentialMutationLock>> = null;
  let backupCodesRegenerated = false;
  try {
    const context = await enrollmentSession();
    if (!context.ok) return context.error;
    const { requestHeaders, session, state } = context;
    actorUserId = session.user.id;
    if (!state.twoFactorEnabled || state.twoFactor?.verified !== true) {
      return failure("ADMIN_MFA_ENROLLMENT_REQUIRED", "Complete administrator two-factor enrollment first");
    }
    if (Date.now() - session.session.createdAt.getTime() > RECENT_SESSION_SECONDS * 1000) {
      return failure("RECENT_SESSION_REQUIRED", "Sign in again before regenerating backup codes");
    }
    lock = await tryAcquireCredentialMutationLock(actorUserId);
    if (!lock) return failure("CONFLICT", "Another credential operation is in progress");

    const result = await auth.api.generateBackupCodes({
      headers: requestHeaders,
      body: { password: input.password },
    });
    backupCodesRegenerated = true;
    const revokedSessions = (
      await prisma.session.deleteMany({
        where: { userId: actorUserId, id: { not: session.session.id } },
      })
    ).count;
    if (!await safeAudit({
      action: "auth.mfa.backup_codes_regenerated",
      actorUserId,
      targetUserId: actorUserId,
      outcome: "SUCCEEDED",
      safeMetadata: { revokedSessions, recentSessionSeconds: RECENT_SESSION_SECONDS },
    })) {
      await prisma.session.deleteMany({ where: { userId: actorUserId } });
      return failure("INTERNAL_ERROR", "Backup codes changed; sign in again");
    }
    return { success: true, data: { backupCodes: result.backupCodes, revokedSessions: revokedSessions } };
  } catch (error) {
    if (backupCodesRegenerated && actorUserId) {
      await prisma.session.deleteMany({ where: { userId: actorUserId } })
        .catch((cleanupError) => logUnexpected("backup-session-cleanup", cleanupError));
    }
    const mapped = safeFailure(error);
    if (mapped.error.code === "INTERNAL_ERROR") logUnexpected("regenerate-backup-codes", error);
    return mapped;
  } finally {
    await lock?.release().catch((error) => logUnexpected("backup-lock-release", error));
  }
}
