import "server-only";

import { headers } from "next/headers";
import { isAPIError } from "better-auth/api";
import { prisma } from "@/lib/persistence/prisma";
import { auth } from "@/lib/auth/auth";
import {
  tryAcquireCredentialMutationLock,
  type CredentialMutationLock,
} from "@/lib/auth/credential-mutation-lock";
import { getCurrentSession } from "@/lib/auth/session";
import { writeAuthAudit } from "@/lib/auth/audit";
import {
  isTemporaryPasswordExpired,
  trialExpiresAt,
} from "@/lib/auth/trial-policy";
import type { ServiceResponse } from "@/lib/api-responses";
import type {
  ChangeTemporaryPasswordDto,
  TemporaryPasswordState,
  TemporaryPasswordReplacementResult,
} from "../types/temporary-password.types";

function failure<T>(code: string, message: string): ServiceResponse<T> {
  return { success: false, error: { code, message } };
}

function logUnexpected(operation: string, error: unknown): void {
  console.error("Temporary-password operation failed", {
    operation,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
}

function betterAuthErrorCode(error: unknown): string | null {
  if (!isAPIError(error)) return null;
  const body = error.body as { code?: unknown } | undefined;
  return typeof body?.code === "string" ? body.code : null;
}

export async function getTemporaryPasswordState(): Promise<
  ServiceResponse<TemporaryPasswordState>
> {
  try {
    const session = await getCurrentSession();
    if (!session) return failure("UNAUTHENTICATED", "Authentication required");
    if (session.user.status !== "active") {
      return failure("ACCOUNT_INACTIVE", "Account is inactive");
    }
    if (!session.user.temporaryPasswordChangeRequired) {
      return {
        success: true,
        data: {
          status: "complete",
          trialExpiresAt: session.user.trialExpiresAt?.toISOString() ?? null,
        },
      };
    }
    const expiresAt = session.user.temporaryPasswordExpiresAt;
    const purpose = session.user.temporaryPasswordPurpose;
    if (!purpose) {
      return failure("INTERNAL_ERROR", "Temporary-password state is inconsistent");
    }
    return {
      success: true,
      data: isTemporaryPasswordExpired(expiresAt)
        ? { status: "expired", purpose, expiresAt: expiresAt?.toISOString() ?? null }
        : { status: "required", purpose, expiresAt: expiresAt!.toISOString() },
    };
  } catch (error) {
    logUnexpected("state", error);
    return failure("INTERNAL_ERROR", "Unable to load activation state");
  }
}

export async function changeTemporaryPassword(
  dto: ChangeTemporaryPasswordDto,
): Promise<ServiceResponse<TemporaryPasswordReplacementResult>> {
  let actorUserId: string | null = null;
  let auditAction: "user.activate" | "user.password_recover" = "user.activate";
  let mutationLock: CredentialMutationLock | null = null;
  try {
    const requestHeaders = await headers();
    const session = await getCurrentSession(requestHeaders);
    if (!session) return failure("UNAUTHENTICATED", "Authentication required");
    actorUserId = session.user.id;
    if (session.user.status !== "active") {
      return failure("ACCOUNT_INACTIVE", "Account is inactive");
    }

    mutationLock = await tryAcquireCredentialMutationLock(session.user.id);
    if (!mutationLock) {
      return failure(
        "PASSWORD_REPLACEMENT_FAILED",
        "Another credential change is already in progress",
      );
    }

    return await prisma.$transaction(async (transaction) => {
      const current = await transaction.user.findUnique({
        where: { id: session.user.id },
        select: {
          status: true,
          temporaryPasswordChangeRequired: true,
          temporaryPasswordExpiresAt: true,
          temporaryPasswordPurpose: true,
          trialActivatedAt: true,
          trialExpiresAt: true,
        },
      });
      if (!current || current.status !== "active") {
        return failure("ACCOUNT_INACTIVE", "Account is inactive");
      }
      if (
        !current.temporaryPasswordChangeRequired &&
        current.trialActivatedAt &&
        current.trialExpiresAt
      ) {
        return {
          success: true,
          data: {
            activatedAt: current.trialActivatedAt.toISOString(),
            trialExpiresAt: current.trialExpiresAt.toISOString(),
            revokedSessions: 0,
            replayed: true,
          },
        };
      }
      if (!current.temporaryPasswordChangeRequired) {
        return failure(
          "TEMPORARY_PASSWORD_CHANGE_NOT_REQUIRED",
          "Temporary-password replacement is not required",
        );
      }

      const isActivation =
        current.temporaryPasswordPurpose === "activation" &&
        current.trialActivatedAt === null &&
        current.trialExpiresAt === null;
      const isRecovery =
        current.temporaryPasswordPurpose === "recovery" &&
        current.trialActivatedAt !== null &&
        current.trialExpiresAt !== null;
      if (!isActivation && !isRecovery) {
        throw new Error("Temporary-password state is inconsistent");
      }
      auditAction = isRecovery ? "user.password_recover" : "user.activate";

      if (isTemporaryPasswordExpired(current.temporaryPasswordExpiresAt)) {
        await writeAuthAudit(
          {
            action: auditAction,
            actorUserId,
            targetUserId: actorUserId,
            outcome: "DENIED",
            safeMetadata: { reason: "TEMPORARY_PASSWORD_EXPIRED" },
          },
          transaction,
        );
        return failure(
          "TEMPORARY_PASSWORD_EXPIRED",
          "Temporary credential has expired",
        );
      }

      await auth.api.changePassword({
        headers: requestHeaders,
        body: {
          currentPassword: dto.currentPassword,
          newPassword: dto.newPassword,
          revokeOtherSessions: false,
        },
      });

      const changedAt = new Date();
      const activatedAt = current.trialActivatedAt ?? changedAt;
      const expiresAt = current.trialExpiresAt ?? trialExpiresAt(activatedAt);
      const activated = await transaction.user.updateMany({
        where: {
          id: session.user.id,
          status: "active",
          temporaryPasswordChangeRequired: true,
          temporaryPasswordExpiresAt: { gt: changedAt },
          temporaryPasswordPurpose: current.temporaryPasswordPurpose,
          trialActivatedAt: current.trialActivatedAt,
          trialExpiresAt: current.trialExpiresAt,
        },
        data: {
          temporaryPasswordChangeRequired: false,
          temporaryPasswordExpiresAt: null,
          temporaryPasswordPurpose: null,
          ...(isActivation
            ? { trialActivatedAt: activatedAt, trialExpiresAt: expiresAt }
            : {}),
        },
      });
      if (activated.count !== 1) {
        throw new Error("Trial activation state changed unexpectedly");
      }
      const revokedSessions = (
        await transaction.session.deleteMany({
          where: { userId: session.user.id, id: { not: session.session.id } },
        })
      ).count;
      await writeAuthAudit(
        {
          action: auditAction,
          actorUserId,
          targetUserId: actorUserId,
          outcome: "SUCCEEDED",
          safeMetadata: {
            trialExpiresAt: expiresAt.toISOString(),
            revokedSessions,
            purpose: isActivation ? "activation" : "recovery",
          },
        },
        transaction,
      );
      return {
        success: true,
        data: {
          activatedAt: activatedAt.toISOString(),
          trialExpiresAt: expiresAt.toISOString(),
          revokedSessions,
          replayed: false,
        },
      };
    }, { isolationLevel: "Serializable", timeout: 15_000 });
  } catch (error) {
    const code = betterAuthErrorCode(error);
    const safeCode = code === "INVALID_PASSWORD"
      ? "INVALID_CURRENT_PASSWORD"
      : "PASSWORD_REPLACEMENT_FAILED";
    try {
      await writeAuthAudit({
        action: auditAction,
        actorUserId,
        targetUserId: actorUserId,
        outcome: code === "INVALID_PASSWORD" ? "DENIED" : "FAILED",
        safeMetadata: { reason: safeCode },
      });
    } catch (auditError) {
      logUnexpected("failure-audit", auditError);
      return failure("INTERNAL_ERROR", "Unable to audit account activation");
    }
    if (code === "INVALID_PASSWORD") {
      return failure("INVALID_CURRENT_PASSWORD", "Current password is invalid");
    }
    logUnexpected("change", error);
    return failure(
      "PASSWORD_REPLACEMENT_FAILED",
      "Unable to complete password replacement",
    );
  } finally {
    if (mutationLock) {
      try {
        await mutationLock.release();
      } catch (lockReleaseError) {
        logUnexpected("credential-lock-release", lockReleaseError);
      }
    }
  }
}
