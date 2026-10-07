import "server-only";

import { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { requireAdminCapability } from "@/lib/auth/admin-authorization";
import { writeAuthAudit } from "@/lib/auth/audit";
import { AuthError, type AdminProfile } from "@/lib/auth/types";
import type { ServiceResponse } from "@/lib/api-responses";
import type {
  AdminProfileMutationDto,
  AdminProfileMutationResult,
} from "../types/admin-profile-mutation.types";

type MutationKind = "promote_operator" | "demote_operator";
type MutationAction = "admin.profile.promote" | "admin.profile.demote";

function failure<T>(code: string, message = code): ServiceResponse<T> {
  return { success: false, error: { code, message } };
}

function isPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
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

async function denied(
  transaction: Prisma.TransactionClient,
  input: {
    action: MutationAction;
    actorUserId: string;
    targetUserId: string;
    operationId: string;
    reason: string;
  },
): Promise<{ error: string }> {
  await writeAuthAudit(
    {
      action: input.action,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      outcome: "DENIED",
      correlationId: input.operationId,
      safeMetadata: { reason: input.reason },
    },
    transaction,
  );
  return { error: input.reason };
}

function replayResult(
  record: {
    kind: string;
    targetUserId: string | null;
    toRole: "trial_user" | "platform_admin";
    toAdminProfile: AdminProfile | null;
    targetVersion: number;
    revokedSessions: number;
  },
  dto: AdminProfileMutationDto,
  kind: MutationKind,
  profile: AdminProfile | null,
): AdminProfileMutationResult | null {
  if (
    record.kind !== kind ||
    record.targetUserId !== dto.targetUserId ||
    record.toRole !== (profile === null ? "trial_user" : "platform_admin") ||
    record.toAdminProfile !== profile ||
    record.targetVersion !== dto.expectedVersion + 1
  ) {
    return null;
  }
  return {
    userId: dto.targetUserId,
    adminProfile: profile,
    adminProfileVersion: record.targetVersion,
    revokedSessions: record.revokedSessions,
    replayed: true,
  };
}

async function mutateAdminProfile(
  dto: AdminProfileMutationDto,
  kind: MutationKind,
): Promise<ServiceResponse<AdminProfileMutationResult>> {
  const action: MutationAction =
    kind === "promote_operator" ? "admin.profile.promote" : "admin.profile.demote";
  let actorUserId: string | null = null;
  try {
    const actor = await requireAdminCapability("admin.manage");
    actorUserId = actor.user.id;
    const result = await prisma.$transaction(async (transaction) => {
      await lockTarget(transaction, dto.targetUserId);
      const existingOperation = await transaction.adminProfileMutation.findUnique({
        where: { operationId: dto.operationId },
        select: {
          kind: true,
          targetUserId: true,
          toRole: true,
          toAdminProfile: true,
          targetVersion: true,
          revokedSessions: true,
        },
      });
      if (existingOperation) {
        const replay = replayResult(
          existingOperation,
          dto,
          kind,
          kind === "promote_operator" ? "operator" : null,
        );
        if (replay) return { value: replay };
        return denied(transaction, {
          action,
          actorUserId: actor.user.id,
          targetUserId: dto.targetUserId,
          operationId: dto.operationId,
          reason: "DUPLICATE_OPERATION",
        });
      }

      const target = await transaction.user.findUnique({
        where: { id: dto.targetUserId },
        select: {
          id: true,
          role: true,
          adminProfile: true,
          adminProfileVersion: true,
          status: true,
          accounts: {
            where: { providerId: "credential", password: { not: null } },
            select: { id: true },
          },
          workspace: { select: { id: true, lifecycle: true } },
        },
      });
      if (!target) {
        return denied(transaction, {
          action,
          actorUserId: actor.user.id,
          targetUserId: dto.targetUserId,
          operationId: dto.operationId,
          reason: "USER_NOT_FOUND",
        });
      }
      if (target.adminProfileVersion !== dto.expectedVersion) {
        return denied(transaction, {
          action,
          actorUserId: actor.user.id,
          targetUserId: target.id,
          operationId: dto.operationId,
          reason: "STALE_ADMIN_PROFILE_VERSION",
        });
      }

      const promoting = kind === "promote_operator";
      const readyTrialIdentity =
        target.accounts.length > 0 && target.workspace?.lifecycle === "ACTIVE";
      let targetError: string | null = null;
      if (promoting) {
        if (
          target.role !== "trial_user" ||
          target.adminProfile !== null ||
          target.status !== "active" ||
          !readyTrialIdentity
        ) {
          targetError = "INVALID_ADMIN_PROFILE_TARGET";
        }
      } else if (target.adminProfile === "owner" || target.id === actor.user.id) {
        targetError = "OWNER_PROTECTED";
      } else if (
        target.role !== "platform_admin" ||
        target.adminProfile !== "operator"
      ) {
        targetError = "INVALID_ADMIN_PROFILE_TARGET";
      } else if (!readyTrialIdentity) {
        targetError = "ADMIN_PROFILE_DEMOTION_BLOCKED";
      }
      if (targetError) {
        return denied(transaction, {
          action,
          actorUserId: actor.user.id,
          targetUserId: target.id,
          operationId: dto.operationId,
          reason: targetError,
        });
      }

      const nextVersion = dto.expectedVersion + 1;
      const changed = await transaction.user.updateMany({
        where: {
          id: target.id,
          role: target.role,
          adminProfile: target.adminProfile,
          adminProfileVersion: dto.expectedVersion,
          status: target.status,
        },
        data: {
          role: promoting ? "platform_admin" : "trial_user",
          adminProfile: promoting ? "operator" : null,
          adminProfileVersion: nextVersion,
          ...(!promoting ? { twoFactorEnabled: false } : {}),
        },
      });
      if (changed.count !== 1) {
        return denied(transaction, {
          action,
          actorUserId: actor.user.id,
          targetUserId: target.id,
          operationId: dto.operationId,
          reason: "STALE_ADMIN_PROFILE_VERSION",
        });
      }

      const revokedSessions = (
        await transaction.session.deleteMany({ where: { userId: target.id } })
      ).count;
      if (!promoting) {
        await transaction.twoFactor.deleteMany({ where: { userId: target.id } });
      }
      await transaction.adminProfileMutation.create({
        data: {
          operationId: dto.operationId,
          kind,
          targetUserId: target.id,
          initiatedByUserId: actor.user.id,
          fromRole: target.role,
          fromAdminProfile: target.adminProfile,
          toRole: promoting ? "platform_admin" : "trial_user",
          toAdminProfile: promoting ? "operator" : null,
          targetVersion: nextVersion,
          revokedSessions,
        },
      });
      await writeAuthAudit(
        {
          action,
          actorUserId: actor.user.id,
          targetUserId: target.id,
          outcome: "SUCCEEDED",
          correlationId: dto.operationId,
          safeMetadata: {
            fromProfile: target.adminProfile,
            toProfile: promoting ? "operator" : null,
            version: nextVersion,
            revokedSessions,
          },
        },
        transaction,
      );
      return {
        value: {
          userId: target.id,
          adminProfile: promoting ? "operator" as const : null,
          adminProfileVersion: nextVersion,
          revokedSessions,
          replayed: false,
        },
      };
    }, { isolationLevel: "Serializable", timeout: 15_000 });

    if ("error" in result) return failure(result.error);
    return { success: true, data: result.value };
  } catch (error) {
    if (error instanceof AuthError) return failure(error.code);
    const code = isPrismaCode(error, "P2002")
      ? "DUPLICATE_OPERATION"
      : isPrismaCode(error, "P2034")
        ? "STALE_ADMIN_PROFILE_VERSION"
        : "INTERNAL_ERROR";
    if (actorUserId) {
      try {
        await writeAuthAudit({
          action,
          actorUserId,
          targetUserId: dto.targetUserId,
          outcome: "FAILED",
          correlationId: dto.operationId,
          safeMetadata: { reason: code },
        });
      } catch (auditError) {
        console.error("Administrator profile failure audit failed", {
          action,
          errorName: auditError instanceof Error ? auditError.name : "UnknownError",
        });
      }
    }
    console.error("Admin profile mutation failed", {
      kind,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return code === "INTERNAL_ERROR"
      ? failure(code, "Unable to update administrator profile")
      : failure(code);
  }
}

export function promoteUserToOperator(
  dto: AdminProfileMutationDto,
): Promise<ServiceResponse<AdminProfileMutationResult>> {
  return mutateAdminProfile(dto, "promote_operator");
}

export function demoteOperatorToTrialUser(
  dto: AdminProfileMutationDto,
): Promise<ServiceResponse<AdminProfileMutationResult>> {
  return mutateAdminProfile(dto, "demote_operator");
}
