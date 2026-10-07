import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { requireAdminCapability } from "@/lib/auth/admin-authorization";
import { verifyAdminStepUp } from "@/lib/auth/admin-step-up";
import { writeAuthAudit } from "@/lib/auth/audit";
import { requireActiveSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/types";
import type { ServiceResponse } from "@/lib/api-responses";
import type {
  InitiateOwnershipTransferDto,
  OperatorMfaRecoveryDto,
  OperatorMfaRecoveryResult,
  OwnershipTransferMutationResult,
  OwnershipTransferStatus,
  OwnershipTransferView,
  ResolveOwnershipTransferDto,
} from "../types/admin-security.types";

const TRANSFER_WINDOW_MS = 30 * 60 * 1_000;
const TRANSACTION_OPTIONS = { isolationLevel: "Serializable" as const, timeout: 15_000 };

type SecurityOperationKind =
  | "operator_mfa_recovery"
  | "ownership_transfer_initiate"
  | "ownership_transfer_cancel"
  | "ownership_transfer_decline"
  | "ownership_transfer_accept";

function failure<T>(code: string, message = code): ServiceResponse<T> {
  return { success: false, error: { code, message } };
}

function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: unknown }).code === code;
}

function fingerprint(value: Record<string, string | number | null | undefined>): string {
  return createHash("sha256").update(JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))),
  )).digest("hex");
}

async function lockOwnership(transaction: Prisma.TransactionClient): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended('ownership-transfer', 0))::text AS lock_status`,
  );
}

async function lockOperation(
  transaction: Prisma.TransactionClient,
  operationId: string,
): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`admin-security:${operationId}`}, 0))::text AS lock_status`,
  );
}

async function lockUsers(
  transaction: Prisma.TransactionClient,
  userIds: readonly string[],
): Promise<void> {
  const ordered = [...new Set(userIds)].sort();
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "users" WHERE "id" IN (${Prisma.join(ordered)}) ORDER BY "id" FOR UPDATE`,
  );
}

async function lockTarget(
  transaction: Prisma.TransactionClient,
  targetUserId: string,
): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${targetUserId}, 0))::text AS lock_status`,
  );
}

const administratorSelect = {
  id: true,
  role: true,
  adminProfile: true,
  adminProfileVersion: true,
  status: true,
  temporaryPasswordChangeRequired: true,
  twoFactorEnabled: true,
  twoFactor: { select: { verified: true } },
  accounts: {
    where: { providerId: "credential", password: { not: null } },
    select: { id: true },
  },
  workspace: { select: { id: true, lifecycle: true } },
} as const;

function isReadyAdministrator(
  value: any,
  profile: "owner" | "operator",
  allowSuspended = false,
): boolean {
  return value?.role === "platform_admin" && value.adminProfile === profile &&
    (value.status === "active" || (allowSuspended && value.status === "suspended")) &&
    value.temporaryPasswordChangeRequired === false && value.twoFactorEnabled === true &&
    value.twoFactor?.verified === true && value.accounts?.length > 0 &&
    value.workspace?.lifecycle === "ACTIVE";
}

function toTransferView(
  transfer: {
    id: string;
    ownerUserId: string;
    owner: { name: string };
    targetUserId: string;
    target: { name: string };
    ownerVersion: number;
    targetVersion: number;
    status: OwnershipTransferStatus;
    initiatedAt: Date;
    expiresAt: Date;
    resolvedAt: Date | null;
  },
  actorUserId: string,
): OwnershipTransferView {
  const pending = transfer.status === "pending" && transfer.expiresAt.getTime() > Date.now();
  return {
    id: transfer.id,
    ownerUserId: transfer.ownerUserId,
    ownerName: transfer.owner.name,
    targetUserId: transfer.targetUserId,
    targetName: transfer.target.name,
    ownerVersion: transfer.ownerVersion,
    targetVersion: transfer.targetVersion,
    status: pending ? "pending" : transfer.status,
    initiatedAt: transfer.initiatedAt.toISOString(),
    expiresAt: transfer.expiresAt.toISOString(),
    resolvedAt: transfer.resolvedAt?.toISOString() ?? null,
    canCancel: pending && actorUserId === transfer.ownerUserId,
    canAccept: pending && actorUserId === transfer.targetUserId,
    canDecline: pending && actorUserId === transfer.targetUserId,
  };
}

async function expireTransfer(
  transaction: Prisma.TransactionClient,
  transfer: { id: string; ownerUserId: string; targetUserId: string; status: string; expiresAt: Date },
  now: Date,
): Promise<boolean> {
  if (transfer.status !== "pending" || transfer.expiresAt.getTime() > now.getTime()) return false;
  const changed = await transaction.ownershipTransfer.updateMany({
    where: { id: transfer.id, status: "pending", expiresAt: { lte: now } },
    data: { status: "expired", pendingKey: null, resolvedAt: now },
  });
  if (changed.count !== 1) return false;
  const operationId = randomUUID();
  await transaction.adminSecurityOperation.create({
    data: {
      operationId,
      kind: "ownership_transfer_expire",
      parameterFingerprint: fingerprint({ kind: "ownership_transfer_expire", transferId: transfer.id }),
      actorUserId: null,
      targetUserId: transfer.targetUserId,
      ownershipTransferId: transfer.id,
      status: "succeeded",
      completedAt: now,
    },
  });
  await writeAuthAudit({
    action: "ownership.transfer.expired",
    targetUserId: transfer.targetUserId,
    outcome: "SUCCEEDED",
    correlationId: operationId,
    safeMetadata: { transferId: transfer.id },
  }, transaction);
  return true;
}

async function auditFailure(input: {
  action: "auth.mfa.operator_recovery_denied" | "ownership.transfer.conflict";
  actorUserId: string | null;
  targetUserId?: string;
  operationId: string;
  code: string;
}): Promise<void> {
  try {
    await writeAuthAudit({
      action: input.action,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      outcome: "DENIED",
      correlationId: input.operationId,
      safeMetadata: { reason: input.code },
    });
  } catch (error) {
    console.error("Administrative security failure audit failed", {
      action: input.action,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

async function persistDeniedOperation(
  transaction: Prisma.TransactionClient,
  input: {
    operationId: string;
    kind: SecurityOperationKind;
    parameterFingerprint: string;
    actorUserId: string | null;
    targetUserId?: string | null;
    ownershipTransferId?: string | null;
    recoveryReason?: OperatorMfaRecoveryDto["reason"];
    operationalReference?: string;
    expectedActorVersion?: number;
    expectedTargetVersion?: number;
    action: "auth.mfa.operator_recovery_denied" | "ownership.transfer.conflict";
    code: string;
  },
): Promise<{ error: string; denialRecorded: true }> {
  const completedAt = new Date();
  await transaction.adminSecurityOperation.create({
    data: {
      operationId: input.operationId,
      kind: input.kind,
      parameterFingerprint: input.parameterFingerprint,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      ownershipTransferId: input.ownershipTransferId,
      recoveryReason: input.recoveryReason,
      operationalReference: input.operationalReference,
      expectedActorVersion: input.expectedActorVersion,
      expectedTargetVersion: input.expectedTargetVersion,
      status: "denied",
      safeFailureCode: input.code,
      completedAt,
    },
  });
  await writeAuthAudit({
    action: input.action,
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    outcome: "DENIED",
    correlationId: input.operationId,
    safeMetadata: { reason: input.code },
  }, transaction);
  return { error: input.code, denialRecorded: true };
}

async function persistPreflightDenial(input: {
  operationId: string;
  kind: SecurityOperationKind;
  parameterFingerprint: string;
  actorUserId: string | null;
  recoveryReason?: OperatorMfaRecoveryDto["reason"];
  expectedActorVersion?: number;
  expectedTargetVersion?: number;
  action: "auth.mfa.operator_recovery_denied" | "ownership.transfer.conflict";
  code: string;
}): Promise<"recorded" | "matching" | "mismatch" | "failed"> {
  try {
    return await prisma.$transaction(async (transaction) => {
      await lockOperation(transaction, input.operationId);
      const existing = await transaction.adminSecurityOperation.findUnique({
        where: { operationId: input.operationId },
        select: { kind: true, parameterFingerprint: true },
      });
      if (existing) {
        if (
          existing.kind !== input.kind ||
          existing.parameterFingerprint !== input.parameterFingerprint
        ) {
          await writeAuthAudit({
            action: "ownership.transfer.conflict",
            actorUserId: input.actorUserId,
            outcome: "DENIED",
            correlationId: input.operationId,
            safeMetadata: { reason: "DUPLICATE_OPERATION" },
          }, transaction);
          return "mismatch" as const;
        }
        await writeAuthAudit({
          action: input.action,
          actorUserId: input.actorUserId,
          outcome: "DENIED",
          correlationId: input.operationId,
          safeMetadata: { reason: input.code, repeatedAttempt: true },
        }, transaction);
        return "matching" as const;
      }
      await persistDeniedOperation(transaction, input);
      return "recorded" as const;
    }, TRANSACTION_OPTIONS);
  } catch (error) {
    console.error("Administrative security denial persistence failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return "failed";
  }
}

export async function recoverOperatorMfa(
  dto: OperatorMfaRecoveryDto,
): Promise<ServiceResponse<OperatorMfaRecoveryResult>> {
  const stepUp = await verifyAdminStepUp({ password: dto.password, totpCode: dto.totpCode });
  if (!stepUp.success) {
    const parameterFingerprint = fingerprint({
      kind: "operator_mfa_recovery",
      actorUserId: stepUp.actorUserId,
      targetUserId: dto.targetUserId,
      expectedVersion: dto.expectedAdminProfileVersion,
      reason: dto.reason,
      reference: dto.operationalReference,
    });
    if (stepUp.actorUserId) {
      const denial = await persistPreflightDenial({
        operationId: dto.operationId,
        kind: "operator_mfa_recovery",
        parameterFingerprint,
        actorUserId: stepUp.actorUserId,
        recoveryReason: dto.reason,
        expectedTargetVersion: dto.expectedAdminProfileVersion,
        action: "auth.mfa.operator_recovery_denied",
        code: stepUp.code,
      });
      if (denial === "mismatch") return failure("DUPLICATE_OPERATION");
    } else {
      await auditFailure({
        action: "auth.mfa.operator_recovery_denied",
        actorUserId: null,
        operationId: dto.operationId,
        code: stepUp.code,
      });
    }
    return failure(stepUp.code);
  }
  const actorUserId = stepUp.session.user.id;
  const parameterFingerprint = fingerprint({
    kind: "operator_mfa_recovery",
    actorUserId,
    targetUserId: dto.targetUserId,
    expectedVersion: dto.expectedAdminProfileVersion,
    reason: dto.reason,
    reference: dto.operationalReference,
  });
  try {
    await requireAdminCapability("admin.mfa.operator.recover", stepUp.requestHeaders);
    const result = await prisma.$transaction(async (transaction) => {
      await lockOperation(transaction, dto.operationId);
      await lockTarget(transaction, dto.targetUserId);
      const existing = await transaction.adminSecurityOperation.findUnique({
        where: { operationId: dto.operationId },
      });
      if (existing) {
        if (
          existing.kind === "operator_mfa_recovery" &&
          existing.parameterFingerprint === parameterFingerprint &&
          existing.status === "succeeded" &&
          existing.targetUserId === dto.targetUserId &&
          existing.actorUserId === actorUserId &&
          existing.committedTargetVersion !== null
        ) {
          return { value: {
            targetUserId: dto.targetUserId,
            adminProfileVersion: existing.committedTargetVersion,
            revokedSessions: existing.revokedTargetSessions,
            replayed: true,
          } };
        }
        return { error: "DUPLICATE_OPERATION" } as const;
      }

      const deny = (code: string, targetUserId?: string | null) =>
        persistDeniedOperation(transaction, {
          operationId: dto.operationId,
          kind: "operator_mfa_recovery",
          parameterFingerprint,
          actorUserId,
          targetUserId,
          recoveryReason: dto.reason,
          operationalReference: dto.operationalReference,
          expectedTargetVersion: dto.expectedAdminProfileVersion,
          action: "auth.mfa.operator_recovery_denied",
          code,
        });

      const [actor, target, definitiveSession] = await Promise.all([
        transaction.user.findUnique({ where: { id: actorUserId }, select: administratorSelect }),
        transaction.user.findUnique({ where: { id: dto.targetUserId }, select: administratorSelect }),
        transaction.session.findUnique({
          where: { id: stepUp.session.session.id },
          select: { userId: true },
        }),
      ]);
      if (definitiveSession?.userId !== actorUserId) return deny("STATE_CHANGED", target?.id);
      if (!isReadyAdministrator(actor, "owner")) return deny("ADMIN_PROFILE_INCONSISTENT", target?.id);
      if (actorUserId === dto.targetUserId) return deny("SELF_RECOVERY_FORBIDDEN", actorUserId);
      if (!target) return deny("USER_NOT_FOUND");
      if (target.adminProfileVersion !== dto.expectedAdminProfileVersion) {
        return deny("STALE_ADMIN_PROFILE_VERSION", target.id);
      }
      if (!isReadyAdministrator(target, "operator", true)) {
        return deny("INVALID_MFA_RECOVERY_TARGET", target.id);
      }

      await writeAuthAudit({
        action: "auth.mfa.operator_recovery_started",
        actorUserId,
        targetUserId: target.id,
        outcome: "ALLOWED",
        correlationId: dto.operationId,
        declaredReason: dto.reason,
        safeMetadata: { hasOperationalReference: Boolean(dto.operationalReference) },
      }, transaction);
      const nextVersion = target.adminProfileVersion + 1;
      const changed = await transaction.user.updateMany({
        where: {
          id: target.id,
          role: "platform_admin",
          adminProfile: "operator",
          adminProfileVersion: dto.expectedAdminProfileVersion,
          status: target.status,
          twoFactorEnabled: true,
        },
        data: { twoFactorEnabled: false, adminProfileVersion: nextVersion },
      });
      if (changed.count !== 1) return deny("STALE_ADMIN_PROFILE_VERSION", target.id);
      const deletedFactor = await transaction.twoFactor.deleteMany({
        where: { userId: target.id, verified: true },
      });
      if (deletedFactor.count !== 1) throw new Error("MFA_FACTOR_STATE_CHANGED");
      const revokedSessions = (await transaction.session.deleteMany({ where: { userId: target.id } })).count;
      await transaction.adminSecurityOperation.create({
        data: {
          operationId: dto.operationId,
          kind: "operator_mfa_recovery",
          parameterFingerprint,
          actorUserId,
          targetUserId: target.id,
          recoveryReason: dto.reason,
          operationalReference: dto.operationalReference,
          expectedTargetVersion: dto.expectedAdminProfileVersion,
          committedTargetVersion: nextVersion,
          status: "succeeded",
          revokedTargetSessions: revokedSessions,
          completedAt: new Date(),
        },
      });
      await writeAuthAudit({
        action: "auth.mfa.operator_recovery_completed",
        actorUserId,
        targetUserId: target.id,
        outcome: "SUCCEEDED",
        correlationId: dto.operationId,
        declaredReason: dto.reason,
        safeMetadata: { version: nextVersion, revokedSessions, suspendedPreserved: target.status === "suspended" },
      }, transaction);
      await writeAuthAudit({
        action: "user.sessions_revoke",
        actorUserId,
        targetUserId: target.id,
        outcome: "SUCCEEDED",
        correlationId: dto.operationId,
        safeMetadata: { reason: "operator_mfa_recovery", revokedSessions },
      }, transaction);
      return { value: {
        targetUserId: target.id,
        adminProfileVersion: nextVersion,
        revokedSessions,
        replayed: false,
      } };
    }, TRANSACTION_OPTIONS);
    const resultError = "error" in result ? result.error : undefined;
    if (resultError) {
      if (!("denialRecorded" in result)) {
        await auditFailure({
          action: "auth.mfa.operator_recovery_denied",
          actorUserId,
          operationId: dto.operationId,
          code: resultError,
        });
      }
      return failure(resultError);
    }
    if (!("value" in result) || !result.value) return failure("INTERNAL_ERROR");
    return { success: true, data: result.value };
  } catch (error) {
    const code = error instanceof AuthError ? error.code
      : isPrismaCode(error, "P2002") ? "DUPLICATE_OPERATION"
      : isPrismaCode(error, "P2034") ? "STATE_CHANGED"
      : "INTERNAL_ERROR";
    const denial = await persistPreflightDenial({
      operationId: dto.operationId,
      kind: "operator_mfa_recovery",
      parameterFingerprint,
      actorUserId,
      recoveryReason: dto.reason,
      expectedTargetVersion: dto.expectedAdminProfileVersion,
      action: "auth.mfa.operator_recovery_denied",
      code,
    });
    if (denial === "mismatch") return failure("DUPLICATE_OPERATION");
    return failure(code, code === "INTERNAL_ERROR" ? "Unable to recover operator MFA" : code);
  }
}

export async function getCurrentOwnershipTransfer(): Promise<
  ServiceResponse<OwnershipTransferView | null>
> {
  try {
    const session = await requireActiveSession();
    const transfer = await prisma.$transaction(async (transaction) => {
      await lockOwnership(transaction);
      const current = await transaction.ownershipTransfer.findFirst({
        where: {
          OR: [{ ownerUserId: session.user.id }, { targetUserId: session.user.id }],
        },
        orderBy: { initiatedAt: "desc" },
        include: { owner: { select: { name: true } }, target: { select: { name: true } } },
      });
      if (!current) return null;
      if (await expireTransfer(transaction, current, new Date())) {
        return transaction.ownershipTransfer.findUnique({
          where: { id: current.id },
          include: { owner: { select: { name: true } }, target: { select: { name: true } } },
        });
      }
      if (current.status === "pending") {
        await lockUsers(transaction, [current.ownerUserId, current.targetUserId]);
        const [owner, target, ownerCount] = await Promise.all([
          transaction.user.findUnique({ where: { id: current.ownerUserId }, select: administratorSelect }),
          transaction.user.findUnique({ where: { id: current.targetUserId }, select: administratorSelect }),
          transaction.user.count({ where: { role: "platform_admin", adminProfile: "owner" } }),
        ]);
        const stillValid = ownerCount === 1 && owner && target &&
          isReadyAdministrator(owner, "owner") && isReadyAdministrator(target, "operator") &&
          owner.adminProfileVersion === current.ownerVersion &&
          target.adminProfileVersion === current.targetVersion;
        if (!stillValid) {
          const operationId = randomUUID();
          await transaction.ownershipTransfer.update({
            where: { id: current.id },
            data: { status: "invalidated", pendingKey: null, resolvedAt: new Date() },
          });
          await writeAuthAudit({
            action: "ownership.transfer.conflict",
            actorUserId: session.user.id,
            targetUserId: current.targetUserId,
            outcome: "DENIED",
            correlationId: operationId,
            safeMetadata: { reason: "STATE_CHANGED", transferId: current.id },
          }, transaction);
          return transaction.ownershipTransfer.findUnique({
            where: { id: current.id },
            include: { owner: { select: { name: true } }, target: { select: { name: true } } },
          });
        }
      }
      return current;
    }, TRANSACTION_OPTIONS);
    return { success: true, data: transfer ? toTransferView(transfer, session.user.id) : null };
  } catch (error) {
    return failure(error instanceof AuthError ? error.code : "INTERNAL_ERROR");
  }
}

export async function initiateOwnershipTransfer(
  dto: InitiateOwnershipTransferDto,
): Promise<ServiceResponse<OwnershipTransferMutationResult>> {
  const stepUp = await verifyAdminStepUp({ password: dto.password, totpCode: dto.totpCode });
  if (!stepUp.success) {
    const parameterFingerprint = fingerprint({
      kind: "ownership_transfer_initiate",
      actorUserId: stepUp.actorUserId,
      targetUserId: dto.targetUserId,
      ownerVersion: dto.expectedOwnerVersion,
      targetVersion: dto.expectedTargetVersion,
    });
    if (stepUp.actorUserId) {
      const denial = await persistPreflightDenial({
        operationId: dto.operationId,
        kind: "ownership_transfer_initiate",
        parameterFingerprint,
        actorUserId: stepUp.actorUserId,
        expectedActorVersion: dto.expectedOwnerVersion,
        expectedTargetVersion: dto.expectedTargetVersion,
        action: "ownership.transfer.conflict",
        code: stepUp.code,
      });
      if (denial === "mismatch") return failure("DUPLICATE_OPERATION");
    } else {
      await auditFailure({
        action: "ownership.transfer.conflict",
        actorUserId: null,
        operationId: dto.operationId,
        code: stepUp.code,
      });
    }
    return failure(stepUp.code);
  }
  const actorUserId = stepUp.session.user.id;
  const parameterFingerprint = fingerprint({
    kind: "ownership_transfer_initiate",
    actorUserId,
    targetUserId: dto.targetUserId,
    ownerVersion: dto.expectedOwnerVersion,
    targetVersion: dto.expectedTargetVersion,
  });
  try {
    await requireAdminCapability("ownership.transfer.initiate", stepUp.requestHeaders);
    const result = await prisma.$transaction(async (transaction) => {
      await lockOwnership(transaction);
      await lockOperation(transaction, dto.operationId);
      const existing = await transaction.adminSecurityOperation.findUnique({ where: { operationId: dto.operationId } });
      if (existing) {
        if (existing.kind === "ownership_transfer_initiate" && existing.parameterFingerprint === parameterFingerprint && existing.status === "succeeded" && existing.ownershipTransferId) {
          const replay = await transaction.ownershipTransfer.findUnique({
            where: { id: existing.ownershipTransferId },
            include: { owner: { select: { name: true } }, target: { select: { name: true } } },
          });
          if (replay) return { value: { transfer: toTransferView(replay, actorUserId), revokedOwnerSessions: 0, revokedTargetSessions: 0, replayed: true } };
        }
        return { error: "DUPLICATE_OPERATION" } as const;
      }
      const deny = (
        code: string,
        targetUserId?: string | null,
        ownershipTransferId?: string | null,
      ) => persistDeniedOperation(transaction, {
        operationId: dto.operationId,
        kind: "ownership_transfer_initiate",
        parameterFingerprint,
        actorUserId,
        targetUserId,
        ownershipTransferId,
        expectedActorVersion: dto.expectedOwnerVersion,
        expectedTargetVersion: dto.expectedTargetVersion,
        action: "ownership.transfer.conflict",
        code,
      });
      const stalePending = await transaction.ownershipTransfer.findFirst({ where: { status: "pending" } });
      if (stalePending) await expireTransfer(transaction, stalePending, new Date());
      const pending = await transaction.ownershipTransfer.findFirst({ where: { status: "pending" } });
      if (pending) return deny("OWNERSHIP_TRANSFER_PENDING");
      if (actorUserId === dto.targetUserId) return deny("INVALID_OWNERSHIP_TARGET", actorUserId);
      await lockUsers(transaction, [actorUserId, dto.targetUserId]);
      const [owner, target, ownerCount, definitiveSession] = await Promise.all([
        transaction.user.findUnique({ where: { id: actorUserId }, select: administratorSelect }),
        transaction.user.findUnique({ where: { id: dto.targetUserId }, select: administratorSelect }),
        transaction.user.count({ where: { role: "platform_admin", adminProfile: "owner" } }),
        transaction.session.findUnique({
          where: { id: stepUp.session.session.id },
          select: { userId: true },
        }),
      ]);
      if (definitiveSession?.userId !== actorUserId) return deny("STATE_CHANGED", target?.id);
      if (!owner || ownerCount !== 1 || !isReadyAdministrator(owner, "owner")) return deny("OWNERSHIP_INVARIANT_VIOLATION", target?.id);
      if (!target || !isReadyAdministrator(target, "operator")) return deny("INVALID_OWNERSHIP_TARGET", target?.id);
      if (owner.adminProfileVersion !== dto.expectedOwnerVersion || target.adminProfileVersion !== dto.expectedTargetVersion) return deny("STALE_ADMIN_PROFILE_VERSION", target.id);
      const now = new Date();
      const transfer = await transaction.ownershipTransfer.create({
        data: {
          initiatedOperationId: dto.operationId,
          ownerUserId: owner.id,
          targetUserId: target.id,
          ownerVersion: owner.adminProfileVersion,
          targetVersion: target.adminProfileVersion,
          expiresAt: new Date(now.getTime() + TRANSFER_WINDOW_MS),
        },
        include: { owner: { select: { name: true } }, target: { select: { name: true } } },
      });
      await transaction.adminSecurityOperation.create({
        data: {
          operationId: dto.operationId,
          kind: "ownership_transfer_initiate",
          parameterFingerprint,
          actorUserId,
          targetUserId: target.id,
          ownershipTransferId: transfer.id,
          expectedActorVersion: owner.adminProfileVersion,
          expectedTargetVersion: target.adminProfileVersion,
          committedActorVersion: owner.adminProfileVersion,
          committedTargetVersion: target.adminProfileVersion,
          status: "succeeded",
          completedAt: now,
        },
      });
      await writeAuthAudit({
        action: "ownership.transfer.initiated",
        actorUserId,
        targetUserId: target.id,
        outcome: "SUCCEEDED",
        correlationId: dto.operationId,
        safeMetadata: { transferId: transfer.id, expiresInMinutes: 30 },
      }, transaction);
      return { value: { transfer: toTransferView(transfer, actorUserId), revokedOwnerSessions: 0, revokedTargetSessions: 0, replayed: false } };
    }, TRANSACTION_OPTIONS);
    const resultError = "error" in result ? result.error : undefined;
    if (resultError) {
      if (!("denialRecorded" in result)) {
        await auditFailure({ action: "ownership.transfer.conflict", actorUserId, operationId: dto.operationId, code: resultError });
      }
      return failure(resultError);
    }
    if (!("value" in result) || !result.value) return failure("INTERNAL_ERROR");
    return { success: true, data: result.value };
  } catch (error) {
    const code = error instanceof AuthError ? error.code
      : isPrismaCode(error, "P2002") ? "OWNERSHIP_TRANSFER_PENDING"
      : isPrismaCode(error, "P2034") ? "STATE_CHANGED"
      : "INTERNAL_ERROR";
    const denial = await persistPreflightDenial({
      operationId: dto.operationId,
      kind: "ownership_transfer_initiate",
      parameterFingerprint,
      actorUserId,
      expectedActorVersion: dto.expectedOwnerVersion,
      expectedTargetVersion: dto.expectedTargetVersion,
      action: "ownership.transfer.conflict",
      code,
    });
    if (denial === "mismatch") return failure("DUPLICATE_OPERATION");
    return failure(code, code === "INTERNAL_ERROR" ? "Unable to initiate ownership transfer" : code);
  }
}

type Resolution = "cancel" | "decline" | "accept";

async function resolveOwnershipTransfer(
  dto: ResolveOwnershipTransferDto,
  resolution: Resolution,
): Promise<ServiceResponse<OwnershipTransferMutationResult>> {
  const kind = `ownership_transfer_${resolution}` as SecurityOperationKind;
  const stepUp = await verifyAdminStepUp({ password: dto.password, totpCode: dto.totpCode });
  if (!stepUp.success) {
    const parameterFingerprint = fingerprint({
      kind,
      actorUserId: stepUp.actorUserId,
      transferId: dto.transferId,
    });
    if (stepUp.actorUserId) {
      const denial = await persistPreflightDenial({
        operationId: dto.operationId,
        kind,
        parameterFingerprint,
        actorUserId: stepUp.actorUserId,
        action: "ownership.transfer.conflict",
        code: stepUp.code,
      });
      if (denial === "mismatch") return failure("DUPLICATE_OPERATION");
    } else {
      await auditFailure({
        action: "ownership.transfer.conflict",
        actorUserId: null,
        operationId: dto.operationId,
        code: stepUp.code,
      });
    }
    return failure(stepUp.code);
  }
  const actorUserId = stepUp.session.user.id;
  const parameterFingerprint = fingerprint({ kind, actorUserId, transferId: dto.transferId });
  try {
    if (resolution === "cancel") {
      await requireAdminCapability("ownership.transfer.cancel", stepUp.requestHeaders);
    } else {
      await requireActiveSession(stepUp.requestHeaders);
    }
    const result = await prisma.$transaction(async (transaction) => {
      await lockOwnership(transaction);
      await lockOperation(transaction, dto.operationId);
      const existing = await transaction.adminSecurityOperation.findUnique({ where: { operationId: dto.operationId } });
      if (existing) {
        if (existing.kind === kind && existing.parameterFingerprint === parameterFingerprint && existing.status === "succeeded" && existing.ownershipTransferId === dto.transferId) {
          const replay = await transaction.ownershipTransfer.findUnique({
            where: { id: dto.transferId },
            include: { owner: { select: { name: true } }, target: { select: { name: true } } },
          });
          if (replay) return { value: {
            transfer: toTransferView(replay, actorUserId),
            revokedOwnerSessions: resolution === "accept" ? existing.revokedTargetSessions : 0,
            revokedTargetSessions: resolution === "accept" ? existing.revokedActorSessions : 0,
            replayed: true,
          } };
        }
        return { error: "DUPLICATE_OPERATION" } as const;
      }
      const transfer = await transaction.ownershipTransfer.findUnique({
        where: { id: dto.transferId },
        include: { owner: { select: { name: true } }, target: { select: { name: true } } },
      });
      const deny = (code: string) => persistDeniedOperation(transaction, {
        operationId: dto.operationId,
        kind,
        parameterFingerprint,
        actorUserId,
        targetUserId: transfer
          ? (resolution === "cancel" ? transfer.targetUserId : transfer.ownerUserId)
          : null,
        ownershipTransferId: transfer?.id,
        expectedActorVersion: transfer
          ? (resolution === "cancel" ? transfer.ownerVersion : transfer.targetVersion)
          : undefined,
        expectedTargetVersion: transfer
          ? (resolution === "cancel" ? transfer.targetVersion : transfer.ownerVersion)
          : undefined,
        action: "ownership.transfer.conflict",
        code,
      });
      if (!transfer) return deny("OWNERSHIP_TRANSFER_NOT_FOUND");
      if (await expireTransfer(transaction, transfer, new Date())) return deny("OWNERSHIP_TRANSFER_EXPIRED");
      if (transfer.status !== "pending") return deny("OWNERSHIP_TRANSFER_RESOLVED");
      const authorized = resolution === "cancel" ? actorUserId === transfer.ownerUserId : actorUserId === transfer.targetUserId;
      if (!authorized) return deny("FORBIDDEN");
      await lockUsers(transaction, [transfer.ownerUserId, transfer.targetUserId]);
      const [owner, target, ownerCount, definitiveSession] = await Promise.all([
        transaction.user.findUnique({ where: { id: transfer.ownerUserId }, select: administratorSelect }),
        transaction.user.findUnique({ where: { id: transfer.targetUserId }, select: administratorSelect }),
        transaction.user.count({ where: { role: "platform_admin", adminProfile: "owner" } }),
        transaction.session.findUnique({
          where: { id: stepUp.session.session.id },
          select: { userId: true },
        }),
      ]);
      if (definitiveSession?.userId !== actorUserId) return deny("STATE_CHANGED");
      if (!owner || !target) {
        await transaction.ownershipTransfer.update({
          where: { id: transfer.id },
          data: { status: "invalidated", pendingKey: null, resolvedAt: new Date() },
        });
        return deny("STATE_CHANGED");
      }
      const validState = ownerCount === 1 && isReadyAdministrator(owner, "owner") && isReadyAdministrator(target, "operator") &&
        owner.adminProfileVersion === transfer.ownerVersion && target.adminProfileVersion === transfer.targetVersion;
      if (!validState) {
        await transaction.ownershipTransfer.update({
          where: { id: transfer.id },
          data: { status: "invalidated", pendingKey: null, resolvedAt: new Date() },
        });
        return deny("STATE_CHANGED");
      }

      const now = new Date();
      let revokedOwnerSessions = 0;
      let revokedTargetSessions = 0;
      if (resolution === "accept") {
        // The existing partial unique owner index is immediate. Demote first,
        // then promote under the global/user locks; MVCC keeps the old owner
        // externally visible until this transaction commits, and any second
        // update failure rolls the whole transaction back.
        const demoted = await transaction.user.updateMany({
          where: {
            id: owner.id,
            role: "platform_admin",
            adminProfile: "owner",
            adminProfileVersion: owner.adminProfileVersion,
          },
          data: {
            adminProfile: "operator",
            adminProfileVersion: owner.adminProfileVersion + 1,
          },
        });
        if (demoted.count !== 1) throw new Error("OWNERSHIP_SWAP_INCOMPLETE");
        const promoted = await transaction.user.updateMany({
          where: {
            id: target.id,
            role: "platform_admin",
            adminProfile: "operator",
            adminProfileVersion: target.adminProfileVersion,
          },
          data: {
            adminProfile: "owner",
            adminProfileVersion: target.adminProfileVersion + 1,
          },
        });
        if (promoted.count !== 1) throw new Error("OWNERSHIP_SWAP_INCOMPLETE");
        const committedOwnerCount = await transaction.user.count({
          where: { role: "platform_admin", adminProfile: "owner" },
        });
        if (committedOwnerCount !== 1) throw new Error("OWNERSHIP_INVARIANT_VIOLATION");
        revokedOwnerSessions = (await transaction.session.deleteMany({ where: { userId: owner.id } })).count;
        revokedTargetSessions = (await transaction.session.deleteMany({ where: { userId: target.id } })).count;
        await transaction.adminProfileMutation.createMany({ data: [
          {
            operationId: randomUUID(), kind: "transfer_demote_owner", targetUserId: owner.id,
            initiatedByUserId: actorUserId, fromRole: "platform_admin", fromAdminProfile: "owner",
            toRole: "platform_admin", toAdminProfile: "operator", targetVersion: owner.adminProfileVersion + 1,
            revokedSessions: revokedOwnerSessions,
          },
          {
            operationId: randomUUID(), kind: "transfer_promote_owner", targetUserId: target.id,
            initiatedByUserId: actorUserId, fromRole: "platform_admin", fromAdminProfile: "operator",
            toRole: "platform_admin", toAdminProfile: "owner", targetVersion: target.adminProfileVersion + 1,
            revokedSessions: revokedTargetSessions,
          },
        ] });
      }
      const status = resolution === "accept" ? "accepted" : resolution === "decline" ? "declined" : "cancelled";
      const resolved = await transaction.ownershipTransfer.update({
        where: { id: transfer.id },
        data: { status, pendingKey: null, resolvedAt: now },
        include: { owner: { select: { name: true } }, target: { select: { name: true } } },
      });
      await transaction.adminSecurityOperation.create({
        data: {
          operationId: dto.operationId,
          kind,
          parameterFingerprint,
          actorUserId,
          targetUserId: resolution === "cancel" ? transfer.targetUserId : transfer.ownerUserId,
          ownershipTransferId: transfer.id,
          expectedActorVersion: resolution === "cancel" ? owner.adminProfileVersion : target.adminProfileVersion,
          expectedTargetVersion: resolution === "cancel" ? target.adminProfileVersion : owner.adminProfileVersion,
          committedActorVersion: resolution === "accept" ? target.adminProfileVersion + 1 : (resolution === "cancel" ? owner.adminProfileVersion : target.adminProfileVersion),
          committedTargetVersion: resolution === "accept" ? owner.adminProfileVersion + 1 : (resolution === "cancel" ? target.adminProfileVersion : owner.adminProfileVersion),
          status: "succeeded",
          revokedActorSessions: resolution === "accept" ? revokedTargetSessions : 0,
          revokedTargetSessions: resolution === "accept" ? revokedOwnerSessions : 0,
          completedAt: now,
        },
      });
      const action = resolution === "accept" ? "ownership.transfer.accepted" : resolution === "decline" ? "ownership.transfer.declined" : "ownership.transfer.cancelled";
      await writeAuthAudit({
        action,
        actorUserId,
        targetUserId: transfer.targetUserId,
        outcome: "SUCCEEDED",
        correlationId: dto.operationId,
        safeMetadata: { transferId: transfer.id, revokedOwnerSessions, revokedTargetSessions },
      }, transaction);
      if (resolution === "accept") {
        await writeAuthAudit({
          action: "user.sessions_revoke",
          actorUserId,
          targetUserId: owner.id,
          outcome: "SUCCEEDED",
          correlationId: dto.operationId,
          safeMetadata: { reason: "ownership_transfer", revokedSessions: revokedOwnerSessions },
        }, transaction);
        await writeAuthAudit({
          action: "user.sessions_revoke",
          actorUserId,
          targetUserId: target.id,
          outcome: "SUCCEEDED",
          correlationId: dto.operationId,
          safeMetadata: { reason: "ownership_transfer", revokedSessions: revokedTargetSessions },
        }, transaction);
      }
      return { value: {
        transfer: toTransferView(resolved, actorUserId),
        revokedOwnerSessions,
        revokedTargetSessions,
        replayed: false,
      } };
    }, TRANSACTION_OPTIONS);
    const resultError = "error" in result ? result.error : undefined;
    if (resultError) {
      if (!("denialRecorded" in result)) {
        await auditFailure({ action: "ownership.transfer.conflict", actorUserId, operationId: dto.operationId, code: resultError });
      }
      return failure(resultError);
    }
    if (!("value" in result) || !result.value) return failure("INTERNAL_ERROR");
    return { success: true, data: result.value };
  } catch (error) {
    const code = error instanceof AuthError ? error.code
      : isPrismaCode(error, "P2002") ? "DUPLICATE_OPERATION"
      : isPrismaCode(error, "P2034") ? "STATE_CHANGED"
      : "INTERNAL_ERROR";
    const denial = await persistPreflightDenial({
      operationId: dto.operationId,
      kind,
      parameterFingerprint,
      actorUserId,
      action: "ownership.transfer.conflict",
      code,
    });
    if (denial === "mismatch") return failure("DUPLICATE_OPERATION");
    return failure(code, code === "INTERNAL_ERROR" ? "Unable to resolve ownership transfer" : code);
  }
}

export function cancelOwnershipTransfer(dto: ResolveOwnershipTransferDto) {
  return resolveOwnershipTransfer(dto, "cancel");
}

export function declineOwnershipTransfer(dto: ResolveOwnershipTransferDto) {
  return resolveOwnershipTransfer(dto, "decline");
}

export function acceptOwnershipTransfer(dto: ResolveOwnershipTransferDto) {
  return resolveOwnershipTransfer(dto, "accept");
}
