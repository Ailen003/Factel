import "server-only";

import { headers } from "next/headers";
import { hashPassword } from "better-auth/crypto";
import { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { writeAuthAudit } from "@/lib/auth/audit";
import { requireAdminCapability } from "@/lib/auth/admin-authorization";
import { AuthError, type AdminProfile } from "@/lib/auth/types";
import { generateTemporaryPassword } from "@/lib/auth/temporary-credential";
import { temporaryPasswordExpiresAt } from "@/lib/auth/trial-policy";
import {
  tryAcquireCredentialMutationLock,
  type CredentialMutationLock,
} from "@/lib/auth/credential-mutation-lock";
import type { ServiceResponse } from "@/lib/api-responses";
import type {
  ConfirmTemporaryCredentialDeliveryDto,
  ReissuedTemporaryCredentialResult,
  ReissueTemporaryCredentialDto,
  TemporaryCredentialDeliveryResult,
  TemporaryCredentialIssuanceMetadata,
} from "../types/temporary-credential-reissue.types";
import { adminTargetPolicyError } from "./admin-target-policy";

type Purpose = "activation" | "recovery";

type PreparedIssuance = {
  id: string;
  targetUserId: string;
  version: number;
  purpose: Purpose;
  suspended: boolean;
  revokedSessions: number;
};

type IssuanceRecord = {
  id: string;
  version: number;
  purpose: Purpose;
  reason: ReissueTemporaryCredentialDto["reason"];
  status: "prepared" | "issued" | "superseded" | "failed";
  preparedAt: Date;
  issuedAt: Date | null;
  expiresAt: Date | null;
  deliveredAt: Date | null;
  deliveryChannel: ConfirmTemporaryCredentialDeliveryDto["channel"] | null;
};

function failure<T>(code: string, message: string): ServiceResponse<T> {
  return { success: false, error: { code, message } };
}

function authFailure<T>(error: unknown): ServiceResponse<T> | null {
  if (!(error instanceof AuthError)) return null;
  return failure(error.code, error.code);
}

function logUnexpected(operation: string, error: unknown): void {
  const errorCode =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    /^P\d{4}$/.test((error as { code: string }).code)
      ? (error as { code: string }).code
      : undefined;
  console.error("Temporary-credential administration failed", {
    operation,
    errorName: error instanceof Error ? error.name : "UnknownError",
    ...(errorCode ? { errorCode } : {}),
  });
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function derivePurpose(input: {
  trialActivatedAt: Date | null;
  trialExpiresAt: Date | null;
}): Purpose | null {
  if (input.trialActivatedAt === null && input.trialExpiresAt === null) {
    return "activation";
  }
  if (input.trialActivatedAt !== null && input.trialExpiresAt !== null) {
    return "recovery";
  }
  return null;
}

function mapIssuance(record: IssuanceRecord): TemporaryCredentialIssuanceMetadata {
  return {
    id: record.id,
    version: record.version,
    purpose: record.purpose,
    reason: record.reason,
    status: record.status,
    preparedAt: record.preparedAt.toISOString(),
    issuedAt: record.issuedAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    deliveredAt: record.deliveredAt?.toISOString() ?? null,
    deliveryChannel: record.deliveryChannel,
  };
}

async function lockTarget(
  transaction: Prisma.TransactionClient,
  targetUserId: string,
): Promise<void> {
  await transaction.$queryRaw(
    // Prisma's PostgreSQL adapter cannot deserialize the native `void` result.
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${targetUserId}, 0))::text AS lock_status`,
  );
}

async function prepareIssuance(
  actorUserId: string,
  actorProfile: AdminProfile | null,
  dto: ReissueTemporaryCredentialDto,
): Promise<
  | { ok: true; value: PreparedIssuance }
  | { ok: false; code: string; message: string }
> {
  return prisma.$transaction(async (transaction) => {
    const duplicate = await transaction.temporaryCredentialIssuance.findUnique({
      where: { operationId: dto.operationId },
      select: { id: true },
    });
    if (duplicate) {
      return {
        ok: false,
        code: "DUPLICATE_OPERATION",
        message: "This credential operation was already used",
      };
    }

    const target = await transaction.user.findUnique({
      where: { id: dto.targetUserId },
      select: {
        id: true,
        role: true,
        adminProfile: true,
        status: true,
        trialActivatedAt: true,
        trialExpiresAt: true,
        temporaryCredentialVersion: true,
      },
    });
    if (!target) {
      return { ok: false, code: "USER_NOT_FOUND", message: "User not found" };
    }
    const targetPolicyError = adminTargetPolicyError({
      actorProfile,
      targetRole: target.role,
      targetProfile: target.adminProfile,
      operation: "credential",
    });
    if (targetPolicyError) {
      await writeAuthAudit(
        {
          action: "user.temporary_credential.prepare",
          actorUserId,
          targetUserId: target.id,
          outcome: "DENIED",
          correlationId: dto.operationId,
          safeMetadata: { reason: targetPolicyError },
        },
        transaction,
      );
      return { ok: false, code: targetPolicyError, message: targetPolicyError };
    }
    if (
      target.role !== "trial_user" ||
      (target.status !== "active" && target.status !== "suspended")
    ) {
      return {
        ok: false,
        code: "INVALID_CREDENTIAL_TARGET",
        message: "Only managed trial users can receive a temporary credential",
      };
    }

    const purpose = derivePurpose(target);
    if (!purpose) {
      return {
        ok: false,
        code: "INVALID_TRIAL_STATE",
        message: "The trial timestamp state is inconsistent",
      };
    }
    if (target.temporaryCredentialVersion !== dto.expectedVersion) {
      return {
        ok: false,
        code: "STALE_CREDENTIAL_VERSION",
        message: "Credential state changed; reload before retrying",
      };
    }

    const current = await transaction.temporaryCredentialIssuance.findFirst({
      where: {
        targetUserId: target.id,
        status: { in: ["prepared", "issued"] },
      },
      orderBy: { version: "desc" },
      select: { id: true, status: true, preparedAt: true },
    });
    if (
      current?.status === "prepared" &&
      dto.reason !== "failure_recovery"
    ) {
      return {
        ok: false,
        code: "CREDENTIAL_ISSUANCE_IN_PROGRESS",
        message: "Another credential issuance is still in progress",
      };
    }

    const preparedAt = new Date();
    const issuanceId = crypto.randomUUID();
    const nextVersion = dto.expectedVersion + 1;
    if (current) {
      await transaction.temporaryCredentialIssuance.update({
        where: { id: current.id },
        data: { status: "superseded", supersededAt: preparedAt },
      });
    }

    const fenced = await transaction.user.updateMany({
      where: {
        id: target.id,
        role: "trial_user",
        status: target.status,
        temporaryCredentialVersion: dto.expectedVersion,
        trialActivatedAt: target.trialActivatedAt,
        trialExpiresAt: target.trialExpiresAt,
      },
      data: {
        temporaryCredentialVersion: nextVersion,
        temporaryPasswordChangeRequired: true,
        temporaryPasswordExpiresAt: new Date(preparedAt.getTime() - 1),
        temporaryPasswordPurpose: purpose,
      },
    });
    if (fenced.count !== 1) {
      throw new Error("Temporary credential version changed during preparation");
    }

    await transaction.temporaryCredentialIssuance.create({
      data: {
        id: issuanceId,
        operationId: dto.operationId,
        targetUserId: target.id,
        initiatedByUserId: actorUserId,
        version: nextVersion,
        purpose,
        reason: dto.reason,
        reasonNote: dto.reason === "other" ? dto.reasonNote!.trim() : null,
        status: "prepared",
        preparedAt,
      },
    });
    if (current) {
      await transaction.temporaryCredentialIssuance.update({
        where: { id: current.id },
        data: { supersededById: issuanceId },
      });
    }

    const revokedSessions = (
      await transaction.session.deleteMany({ where: { userId: target.id } })
    ).count;
    await writeAuthAudit(
      {
        action: "user.temporary_credential.prepare",
        actorUserId,
        targetUserId: target.id,
        outcome: "SUCCEEDED",
        correlationId: dto.operationId,
        declaredReason: dto.reason,
        safeMetadata: {
          issuanceId,
          version: nextVersion,
          purpose,
          suspended: target.status === "suspended",
        },
      },
      transaction,
    );
    await writeAuthAudit(
      {
        action: "user.sessions_revoke",
        actorUserId,
        targetUserId: target.id,
        outcome: "SUCCEEDED",
        correlationId: dto.operationId,
        safeMetadata: { phase: "preparation", revokedSessions },
      },
      transaction,
    );

    return {
      ok: true,
      value: {
        id: issuanceId,
        targetUserId: target.id,
        version: nextVersion,
        purpose,
        suspended: target.status === "suspended",
        revokedSessions,
      },
    };
  }, { isolationLevel: "Serializable", timeout: 15_000 });
}

async function recordFailedIssuance(
  actorUserId: string,
  operationId: string,
  prepared: PreparedIssuance,
  safeFailureCode: string,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const failedAt = new Date();
    const changed = await transaction.temporaryCredentialIssuance.updateMany({
      where: {
        id: prepared.id,
        operationId,
        targetUserId: prepared.targetUserId,
        version: prepared.version,
        status: "prepared",
      },
      data: { status: "failed", failedAt, safeFailureCode },
    });
    if (changed.count === 0) return;
    await writeAuthAudit(
      {
        action: "user.temporary_credential.fail",
        actorUserId,
        targetUserId: prepared.targetUserId,
        outcome: "FAILED",
        correlationId: operationId,
        safeMetadata: {
          issuanceId: prepared.id,
          version: prepared.version,
          purpose: prepared.purpose,
          reason: safeFailureCode,
        },
      },
      transaction,
    );
  }, { isolationLevel: "Serializable", timeout: 15_000 });
}

export async function reissueTemporaryCredential(
  dto: ReissueTemporaryCredentialDto,
): Promise<ServiceResponse<ReissuedTemporaryCredentialResult>> {
  let actorUserId: string | null = null;
  let prepared: PreparedIssuance | null = null;
  let mutationLock: CredentialMutationLock | null = null;
  try {
    const requestHeaders = await headers();
    const actor = await requireAdminCapability(
      "trial.credentials.reissue",
      requestHeaders,
    );
    actorUserId = actor.user.id;

    mutationLock = await tryAcquireCredentialMutationLock(dto.targetUserId);
    if (!mutationLock) {
      return failure(
        "CREDENTIAL_CONFLICT",
        "Another credential mutation is still in progress",
      );
    }

    const preparation = await prepareIssuance(
      actorUserId,
      actor.user.adminProfile,
      dto,
    );
    if (!preparation.ok) {
      return failure(preparation.code, preparation.message);
    }
    prepared = preparation.value;

    const completed = await prisma.$transaction(async (transaction) => {
      const [issuance, target] = await Promise.all([
        transaction.temporaryCredentialIssuance.findUnique({
          where: { id: prepared!.id },
        }),
        transaction.user.findUnique({
          where: { id: prepared!.targetUserId },
          select: {
            id: true,
            role: true,
            status: true,
            temporaryCredentialVersion: true,
            trialActivatedAt: true,
            trialExpiresAt: true,
          },
        }),
      ]);
      if (
        !issuance ||
        issuance.operationId !== dto.operationId ||
        issuance.status !== "prepared" ||
        issuance.version !== prepared!.version ||
        !target ||
        target.role !== "trial_user" ||
        (target.status !== "active" && target.status !== "suspended") ||
        target.temporaryCredentialVersion !== prepared!.version ||
        derivePurpose(target) !== prepared!.purpose
      ) {
        throw new Error("Temporary credential finalization fence failed");
      }

      // The dedicated session advisory lock remains held across the provider
      // mutation. A concurrent issuance therefore cannot overtake a delayed
      // password write. Better Auth owns the hash format; the application
      // transaction owns the authorization, credential update and revocation.
      const temporaryPassword = generateTemporaryPassword();
      const hashedPassword = await hashPassword(temporaryPassword);
      const credentialUpdated = await transaction.account.updateMany({
        where: {
          userId: prepared!.targetUserId,
          providerId: "credential",
          password: { not: null },
        },
        data: { password: hashedPassword },
      });
      if (credentialUpdated.count !== 1) {
        throw new Error("Credential account changed during finalization");
      }
      const postRotationRevokedSessions = (
        await transaction.session.deleteMany({ where: { userId: target.id } })
      ).count;

      const issuedAt = new Date();
      const expiresAt = temporaryPasswordExpiresAt(issuedAt);
      const updatedTarget = await transaction.user.updateMany({
        where: {
          id: target.id,
          role: "trial_user",
          status: target.status,
          temporaryCredentialVersion: prepared!.version,
          trialActivatedAt: target.trialActivatedAt,
          trialExpiresAt: target.trialExpiresAt,
        },
        data: {
          temporaryPasswordChangeRequired: true,
          temporaryPasswordExpiresAt: expiresAt,
          temporaryPasswordPurpose: prepared!.purpose,
        },
      });
      if (updatedTarget.count !== 1) {
        throw new Error("Temporary credential target changed during finalization");
      }

      const issued = await transaction.temporaryCredentialIssuance.update({
        where: { id: prepared!.id },
        data: { status: "issued", issuedAt, expiresAt },
      });
      await writeAuthAudit(
        {
          action: "user.temporary_credential.issue",
          actorUserId,
          targetUserId: target.id,
          outcome: "SUCCEEDED",
          correlationId: dto.operationId,
          declaredReason: dto.reason,
          safeMetadata: {
            issuanceId: issued.id,
            version: issued.version,
            purpose: issued.purpose,
            expiresAt: expiresAt.toISOString(),
          },
        },
        transaction,
      );
      await writeAuthAudit(
        {
          action: "user.sessions_revoke",
          actorUserId,
          targetUserId: target.id,
          outcome: "SUCCEEDED",
          correlationId: dto.operationId,
          safeMetadata: {
            phase: "post_rotation",
            allSessions: true,
            revokedSessions: postRotationRevokedSessions,
          },
        },
        transaction,
      );
      return {
        issuance: issued,
        temporaryPassword,
        revokedSessions: prepared!.revokedSessions + postRotationRevokedSessions,
      };
    }, { isolationLevel: "Serializable", timeout: 15_000 });

    return {
      success: true,
      data: {
        userId: prepared.targetUserId,
        suspended: prepared.suspended,
        temporaryPassword: completed.temporaryPassword,
        revokedSessions: completed.revokedSessions,
        issuance: mapIssuance(completed.issuance),
      },
    };
  } catch (error) {
    const authorization = authFailure<ReissuedTemporaryCredentialResult>(error);
    if (authorization) return authorization;
    if (!prepared && isUniqueConflict(error)) {
      return failure(
        "CREDENTIAL_CONFLICT",
        "Credential state changed; reload before retrying",
      );
    }

    const safeFailureCode = "CREDENTIAL_REISSUE_FAILED";
    if (prepared && actorUserId) {
      try {
        await recordFailedIssuance(
          actorUserId,
          dto.operationId,
          prepared,
          safeFailureCode,
        );
      } catch (failureAuditError) {
        logUnexpected("failure-audit", failureAuditError);
      }
    }
    logUnexpected("reissue", error);
    return failure(
      safeFailureCode,
      "Temporary credential could not be issued; the account remains blocked",
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

export async function confirmTemporaryCredentialDelivery(
  dto: ConfirmTemporaryCredentialDeliveryDto,
): Promise<ServiceResponse<TemporaryCredentialDeliveryResult>> {
  try {
    const requestHeaders = await headers();
    const actor = await requireAdminCapability(
      "trial.credentials.confirm_delivery",
      requestHeaders,
    );
    const result = await prisma.$transaction(async (transaction) => {
      const located = await transaction.temporaryCredentialIssuance.findUnique({
        where: { id: dto.issuanceId },
        select: { targetUserId: true },
      });
      if (!located) {
        return { error: "ISSUANCE_NOT_FOUND" as const };
      }
      await lockTarget(transaction, located.targetUserId);
      const issuance = await transaction.temporaryCredentialIssuance.findUnique({
        where: { id: dto.issuanceId },
        include: {
          target: {
            select: {
              role: true,
              adminProfile: true,
              status: true,
              temporaryCredentialVersion: true,
            },
          },
        },
      });
      if (!issuance) return { error: "ISSUANCE_NOT_FOUND" as const };
      const targetPolicyError = adminTargetPolicyError({
        actorProfile: actor.user.adminProfile,
        targetRole: issuance.target.role,
        targetProfile: issuance.target.adminProfile,
        operation: "credential",
      });
      if (targetPolicyError) {
        await writeAuthAudit(
          {
            action: "user.temporary_credential.deliver",
            actorUserId: actor.user.id,
            targetUserId: issuance.targetUserId,
            outcome: "DENIED",
            correlationId: `credential-delivery:${issuance.id}`,
            safeMetadata: { reason: targetPolicyError },
          },
          transaction,
        );
        return { error: targetPolicyError };
      }
      if (
        issuance.target.role !== "trial_user" ||
        (issuance.target.status !== "active" && issuance.target.status !== "suspended")
      ) {
        return { error: "INVALID_CREDENTIAL_TARGET" as const };
      }
      if (
        issuance.version !== dto.expectedVersion ||
        issuance.target.temporaryCredentialVersion !== dto.expectedVersion
      ) {
        return { error: "STALE_CREDENTIAL_VERSION" as const };
      }
      if (issuance.status === "superseded") {
        return { error: "CREDENTIAL_SUPERSEDED" as const };
      }
      if (issuance.status !== "issued") {
        return { error: "CREDENTIAL_NOT_DELIVERABLE" as const };
      }
      if (issuance.deliveredAt) {
        return issuance.deliveryChannel === dto.channel
          ? { issuance, replayed: true }
          : { error: "DELIVERY_CONFLICT" as const };
      }

      const deliveredAt = new Date();
      const changed = await transaction.temporaryCredentialIssuance.updateMany({
        where: {
          id: issuance.id,
          targetUserId: issuance.targetUserId,
          version: dto.expectedVersion,
          status: "issued",
          deliveredAt: null,
          deliveryChannel: null,
          deliveredByUserId: null,
        },
        data: {
          deliveredAt,
          deliveryChannel: dto.channel,
          deliveredByUserId: actor.user.id,
        },
      });
      if (changed.count !== 1) {
        return { error: "DELIVERY_CONFLICT" as const };
      }
      await writeAuthAudit(
        {
          action: "user.temporary_credential.deliver",
          actorUserId: actor.user.id,
          targetUserId: issuance.targetUserId,
          outcome: "SUCCEEDED",
          correlationId: `credential-delivery:${issuance.id}`,
          safeMetadata: {
            issuanceId: issuance.id,
            version: issuance.version,
            purpose: issuance.purpose,
            channel: dto.channel,
          },
        },
        transaction,
      );
      return {
        issuance: {
          ...issuance,
          deliveredAt,
          deliveryChannel: dto.channel,
        },
        replayed: false,
      };
    }, { isolationLevel: "Serializable", timeout: 15_000 });

    if ("error" in result) {
      const code = result.error ?? "DELIVERY_CONFIRMATION_FAILED";
      return failure(code, code);
    }
    return {
      success: true,
      data: { issuance: mapIssuance(result.issuance), replayed: result.replayed },
    };
  } catch (error) {
    const authorization = authFailure<TemporaryCredentialDeliveryResult>(error);
    if (authorization) return authorization;
    logUnexpected("confirm-delivery", error);
    return failure(
      "DELIVERY_CONFIRMATION_FAILED",
      "Unable to confirm temporary credential delivery",
    );
  }
}
