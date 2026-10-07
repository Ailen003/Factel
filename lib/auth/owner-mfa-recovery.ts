import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import type { ServiceResponse } from "@/lib/api-responses";
import { writeAuthAudit } from "./audit";

export const ownerMfaRecoveryReasons = [
  "lost_all_factors",
  "lost_device",
  "suspected_compromise",
  "operational_recovery",
  "other",
] as const;

export const ownerMfaRecoverySchema = z
  .object({
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    operationId: z.string().uuid(),
    reason: z.enum(ownerMfaRecoveryReasons),
    operationalReference: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[^\r\n\t]+$/)
      .optional(),
    dryRun: z.boolean(),
    confirmed: z.boolean(),
    productionConfirmed: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.dryRun && !value.confirmed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmed"],
        message: "Explicit confirmation is required",
      });
    }
    if (value.dryRun && value.confirmed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dryRun"],
        message: "Dry-run and mutation confirmation are mutually exclusive",
      });
    }
    if (value.reason === "other" && !value.operationalReference) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["operationalReference"],
        message: "A safe operational reference is required for other",
      });
    }
  });

export type OwnerMfaRecoveryInput = z.infer<typeof ownerMfaRecoverySchema>;

export interface OwnerMfaRecoveryResult {
  dryRun: boolean;
  eligibleOwnerCount: number;
  ownerSelected: boolean;
  wouldMutate: boolean;
  replayed: boolean;
  revokedSessions: number;
}

function failure<T>(code: string, message = code): ServiceResponse<T> {
  return { success: false, error: { code, message } };
}

function fingerprint(input: {
  email: string;
  reason: OwnerMfaRecoveryInput["reason"];
  operationalReference?: string;
}): string {
  return createHash("sha256")
    .update(JSON.stringify({
      kind: "owner_mfa_break_glass",
      selectorHash: createHash("sha256").update(input.email).digest("hex"),
      reason: input.reason,
      operationalReference: input.operationalReference ?? null,
    }))
    .digest("hex");
}

function isPrismaCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === code,
  );
}

async function loadOwnerState(database: Prisma.TransactionClient | typeof prisma) {
  const [ownerCount, owners] = await Promise.all([
    database.user.count({
      where: { role: "platform_admin", adminProfile: "owner" },
    }),
    database.user.findMany({
      where: { role: "platform_admin", adminProfile: "owner" },
      select: {
        id: true,
        email: true,
        role: true,
        adminProfile: true,
        adminProfileVersion: true,
        status: true,
        temporaryPasswordChangeRequired: true,
        twoFactorEnabled: true,
        twoFactor: { select: { id: true, verified: true } },
        accounts: {
          where: { providerId: "credential", password: { not: null } },
          select: { id: true },
        },
        workspace: { select: { lifecycle: true } },
      },
      take: 2,
    }),
  ]);
  return { ownerCount, owner: owners.length === 1 ? owners[0] : null };
}

function ownerStateIsConsistent(
  owner: Awaited<ReturnType<typeof loadOwnerState>>["owner"],
): boolean {
  return Boolean(
    owner &&
      owner.role === "platform_admin" &&
      owner.adminProfile === "owner" &&
      owner.status === "active" &&
      !owner.temporaryPasswordChangeRequired &&
      owner.accounts.length === 1 &&
      owner.workspace?.lifecycle === "ACTIVE" &&
      owner.twoFactorEnabled &&
      owner.twoFactor?.verified === true,
  );
}

async function auditRefusal(
  operationId: string,
  reason: string,
  targetUserId?: string | null,
): Promise<boolean> {
  try {
    await writeAuthAudit({
      action: "auth.mfa.owner_break_glass",
      targetUserId: targetUserId ?? null,
      outcome: "DENIED",
      correlationId: operationId,
      safeMetadata: { reason },
    });
    return true;
  } catch {
    return false;
  }
}

async function lockRecoveryOperation(
  transaction: Prisma.TransactionClient,
  operationId: string,
): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`admin-security:${operationId}`}, 0))::text AS lock_status`,
  );
}

async function recordRefusal(
  transaction: Prisma.TransactionClient,
  input: OwnerMfaRecoveryInput,
  parameterFingerprint: string,
  code: string,
  targetUserId?: string | null,
): Promise<{ error: string; denialRecorded: true }> {
  await transaction.adminSecurityOperation.create({
    data: {
      operationId: input.operationId,
      kind: "owner_mfa_break_glass",
      parameterFingerprint,
      targetUserId,
      recoveryReason: input.reason,
      operationalReference: input.operationalReference,
      status: "denied",
      safeFailureCode: code,
      completedAt: new Date(),
    },
  });
  await writeAuthAudit({
    action: "auth.mfa.owner_break_glass",
    targetUserId,
    outcome: "DENIED",
    correlationId: input.operationId,
    safeMetadata: { reason: code },
  }, transaction);
  return { error: code, denialRecorded: true };
}

async function persistRefusalAfterRollback(
  input: OwnerMfaRecoveryInput,
  parameterFingerprint: string,
  code: string,
): Promise<boolean> {
  try {
    await prisma.$transaction(async (transaction) => {
      await lockRecoveryOperation(transaction, input.operationId);
      const existing = await transaction.adminSecurityOperation.findUnique({
        where: { operationId: input.operationId },
        select: { kind: true, parameterFingerprint: true },
      });
      if (existing) return;
      await recordRefusal(transaction, input, parameterFingerprint, code);
    }, { isolationLevel: "Serializable", timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

export async function recoverOwnerMfaBreakGlass(
  rawInput: unknown,
): Promise<ServiceResponse<OwnerMfaRecoveryResult>> {
  const parsed = ownerMfaRecoverySchema.safeParse(rawInput);
  if (!parsed.success) return failure("VALIDATION_ERROR", "Invalid recovery request");
  const input = parsed.data;
  if (process.env.NODE_ENV === "production" && !input.dryRun && !input.productionConfirmed) {
    return failure("PRODUCTION_CONFIRMATION_REQUIRED");
  }
  const parameterFingerprint = fingerprint({
    email: input.email,
    reason: input.reason,
    operationalReference: input.operationalReference,
  });

  if (input.dryRun) {
    try {
      const state = await prisma.$transaction(
        (transaction) => loadOwnerState(transaction),
        { isolationLevel: "Serializable", timeout: 15_000 },
      );
      const selected = state.owner?.email.toLowerCase() === input.email;
      const eligible =
        state.ownerCount === 1 && selected && ownerStateIsConsistent(state.owner);
      return {
        success: true,
        data: {
          dryRun: true,
          eligibleOwnerCount: eligible ? 1 : 0,
          ownerSelected: Boolean(selected),
          wouldMutate: Boolean(eligible),
          replayed: false,
          revokedSessions: 0,
        },
      };
    } catch {
      return failure("INTERNAL_ERROR", "Unable to inspect owner recovery state");
    }
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${"ownership-transfer"}, 0))::text AS lock_status`,
      );
      await lockRecoveryOperation(transaction, input.operationId);
      const existing = await transaction.adminSecurityOperation.findUnique({
        where: { operationId: input.operationId },
      });
      if (existing) {
        if (
          existing.kind === "owner_mfa_break_glass" &&
          existing.parameterFingerprint === parameterFingerprint &&
          existing.status === "succeeded"
        ) {
          return {
            value: {
              dryRun: false,
              eligibleOwnerCount: 1,
              ownerSelected: true,
              wouldMutate: false,
              replayed: true,
              revokedSessions: existing.revokedTargetSessions,
            },
          } as const;
        }
        return { error: "DUPLICATE_OPERATION" } as const;
      }
      const state = await loadOwnerState(transaction);
      if (state.ownerCount !== 1 || !state.owner) {
        return recordRefusal(transaction, input, parameterFingerprint, "OWNER_COUNT_INVALID");
      }
      if (state.owner.email.toLowerCase() !== input.email) {
        return recordRefusal(transaction, input, parameterFingerprint, "OWNER_SELECTION_INVALID");
      }
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${state.owner.id}, 0))::text AS lock_status`,
      );
      const current = await transaction.user.findUnique({
        where: { id: state.owner.id },
        select: {
          id: true,
          email: true,
          role: true,
          adminProfile: true,
          adminProfileVersion: true,
          status: true,
          temporaryPasswordChangeRequired: true,
          twoFactorEnabled: true,
          twoFactor: { select: { id: true, verified: true } },
          accounts: {
            where: { providerId: "credential", password: { not: null } },
            select: { id: true },
          },
          workspace: { select: { lifecycle: true } },
        },
      });
      if (!ownerStateIsConsistent(current as typeof state.owner)) {
        return recordRefusal(
          transaction,
          input,
          parameterFingerprint,
          "OWNER_STATE_INCONSISTENT",
          current?.id,
        );
      }

      const changed = await transaction.user.updateMany({
        where: {
          id: current!.id,
          role: "platform_admin",
          adminProfile: "owner",
          adminProfileVersion: current!.adminProfileVersion,
          status: "active",
          twoFactorEnabled: true,
        },
        data: {
          twoFactorEnabled: false,
          adminProfileVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        return recordRefusal(transaction, input, parameterFingerprint, "STATE_CHANGED", current!.id);
      }
      const deletedFactor = await transaction.twoFactor.deleteMany({
        where: { userId: current!.id, verified: true },
      });
      if (deletedFactor.count !== 1) throw new Error("MFA_FACTOR_STATE_CHANGED");
      const revokedSessions = (
        await transaction.session.deleteMany({ where: { userId: current!.id } })
      ).count;
      const completedAt = new Date();
      await transaction.adminSecurityOperation.create({
        data: {
          operationId: input.operationId,
          kind: "owner_mfa_break_glass",
          parameterFingerprint,
          targetUserId: current!.id,
          recoveryReason: input.reason,
          operationalReference: input.operationalReference,
          expectedTargetVersion: current!.adminProfileVersion,
          committedTargetVersion: current!.adminProfileVersion + 1,
          status: "succeeded",
          revokedTargetSessions: revokedSessions,
          completedAt,
        },
      });
      await writeAuthAudit(
        {
          action: "auth.mfa.owner_break_glass",
          targetUserId: current!.id,
          outcome: "SUCCEEDED",
          correlationId: input.operationId,
          declaredReason: input.reason,
          safeMetadata: {
            operationalReference: input.operationalReference ?? null,
            revokedSessions,
          },
        },
        transaction,
      );
      await writeAuthAudit(
        {
          action: "user.sessions_revoke",
          targetUserId: current!.id,
          outcome: "SUCCEEDED",
          correlationId: input.operationId,
          safeMetadata: { source: "owner-mfa-break-glass", revokedSessions },
        },
        transaction,
      );
      return {
        value: {
          dryRun: false,
          eligibleOwnerCount: 1,
          ownerSelected: true,
          wouldMutate: false,
          replayed: false,
          revokedSessions,
        },
      } as const;
    }, { isolationLevel: "Serializable", timeout: 15_000 });

    if ("error" in result) {
      const resultError = result.error ?? "INTERNAL_ERROR";
      if ("denialRecorded" in result) return failure(resultError);
      const audited = await auditRefusal(input.operationId, resultError);
      return audited ? failure(resultError) : failure("INTERNAL_ERROR");
    }
    return { success: true, data: result.value };
  } catch (error) {
    const code = isPrismaCode(error, "P2002")
      ? "DUPLICATE_OPERATION"
      : isPrismaCode(error, "P2034")
        ? "CONFLICT"
        : "INTERNAL_ERROR";
    await persistRefusalAfterRollback(input, parameterFingerprint, code);
    return failure(code, code === "INTERNAL_ERROR" ? "Owner recovery failed closed" : code);
  }
}
