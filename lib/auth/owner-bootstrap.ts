import "server-only";

import { z } from "zod";
import { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { writeAuthAudit } from "./audit";

const bootstrapOwnerInputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  dryRun: z.boolean(),
  confirmed: z.boolean(),
  productionConfirmed: z.boolean(),
  operationId: z.string().uuid(),
});

export type BootstrapOwnerInput = z.infer<typeof bootstrapOwnerInputSchema>;

interface BootstrapMutationData {
  ownerUserId: string;
  operatorsAssigned: number;
  sessionsRevoked: number;
  idempotent: boolean;
}

type BootstrapMutationOutcome =
  | BootstrapMutationData
  | { error: "USER_NOT_FOUND" | "INVALID_OWNER_TARGET" | "OWNER_ALREADY_EXISTS" };

export type BootstrapOwnerResult =
  | {
      success: true;
      data: BootstrapMutationData & { dryRun: boolean };
    }
  | { success: false; error: { code: string; message: string } };

function failure(code: string, message: string): BootstrapOwnerResult {
  return { success: false, error: { code, message } };
}

async function inspectBootstrap(email: string) {
  const [target, owner, unprofiledAdministrators] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, adminProfile: true, status: true },
    }),
    prisma.user.findFirst({
      where: { adminProfile: "owner" },
      select: { id: true },
    }),
    prisma.user.count({
      where: { role: "platform_admin", adminProfile: null },
    }),
  ]);
  return { target, owner, unprofiledAdministrators };
}

export async function bootstrapInitialOwner(
  rawInput: BootstrapOwnerInput,
): Promise<BootstrapOwnerResult> {
  const parsed = bootstrapOwnerInputSchema.safeParse(rawInput);
  if (!parsed.success) return failure("VALIDATION_ERROR", "Invalid bootstrap input");
  const input = parsed.data;
  if (!input.dryRun && !input.confirmed) {
    return failure("CONFIRMATION_REQUIRED", "Owner bootstrap requires explicit confirmation");
  }
  if (
    !input.dryRun &&
    process.env.NODE_ENV === "production" &&
    !input.productionConfirmed
  ) {
    return failure(
      "PRODUCTION_CONFIRMATION_REQUIRED",
      "Production owner bootstrap requires explicit production confirmation",
    );
  }

  if (input.dryRun) {
    const { target, owner, unprofiledAdministrators } = await inspectBootstrap(input.email);
    if (!target) return failure("USER_NOT_FOUND", "The selected user does not exist");
    if (target.role !== "platform_admin" || target.status !== "active") {
      return failure("INVALID_OWNER_TARGET", "Owner must be an active platform administrator");
    }
    if (owner && owner.id !== target.id) {
      return failure("OWNER_ALREADY_EXISTS", "A different owner already exists");
    }
    return {
      success: true,
      data: {
        dryRun: true,
        idempotent: owner?.id === target.id,
        ownerUserId: target.id,
        operatorsAssigned: Math.max(
          0,
          unprofiledAdministrators - (target.adminProfile === null ? 1 : 0),
        ),
        sessionsRevoked: 0,
      },
    };
  }

  try {
    const data = await prisma.$transaction(async (
      transaction,
    ): Promise<BootstrapMutationOutcome> => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${"talk-flow:owner-bootstrap"}, 0))::text AS lock_status`,
      );
      const target = await transaction.user.findUnique({
        where: { email: input.email },
        select: {
          id: true,
          role: true,
          adminProfile: true,
          adminProfileVersion: true,
          status: true,
        },
      });
      if (!target) return { error: "USER_NOT_FOUND" as const };
      if (target.role !== "platform_admin" || target.status !== "active") {
        return { error: "INVALID_OWNER_TARGET" as const };
      }
      const owner = await transaction.user.findFirst({
        where: { adminProfile: "owner" },
        select: { id: true },
      });
      if (owner?.id === target.id) {
        return {
          ownerUserId: target.id,
          operatorsAssigned: 0,
          sessionsRevoked: 0,
          idempotent: true,
        };
      }
      if (owner) return { error: "OWNER_ALREADY_EXISTS" as const };

      const operatorTargets = await transaction.user.findMany({
        where: {
          id: { not: target.id },
          role: "platform_admin",
          adminProfile: null,
        },
        select: { id: true, adminProfileVersion: true },
      });
      let sessionsRevoked = 0;
      for (const operatorTarget of operatorTargets) {
        const changed = await transaction.user.updateMany({
          where: {
            id: operatorTarget.id,
            role: "platform_admin",
            adminProfile: null,
            adminProfileVersion: operatorTarget.adminProfileVersion,
          },
          data: {
            adminProfile: "operator",
            adminProfileVersion: { increment: 1 },
          },
        });
        if (changed.count !== 1) throw new Error("Concurrent administrator profile change");
        const revoked = await transaction.session.deleteMany({
          where: { userId: operatorTarget.id },
        });
        sessionsRevoked += revoked.count;
        const operationId = crypto.randomUUID();
        await transaction.adminProfileMutation.create({
          data: {
            operationId,
            kind: "bootstrap_operator",
            targetUserId: operatorTarget.id,
            fromRole: "platform_admin",
            fromAdminProfile: null,
            toRole: "platform_admin",
            toAdminProfile: "operator",
            targetVersion: operatorTarget.adminProfileVersion + 1,
            revokedSessions: revoked.count,
          },
        });
        await writeAuthAudit(
          {
            action: "admin.profile.bootstrap",
            targetUserId: operatorTarget.id,
            outcome: "SUCCEEDED",
            correlationId: operationId,
            safeMetadata: {
              profile: "operator",
              revokedSessions: revoked.count,
              source: "owner_bootstrap_cli",
            },
          },
          transaction,
        );
      }

      const ownerChanged = await transaction.user.updateMany({
        where: {
          id: target.id,
          role: "platform_admin",
          status: "active",
          adminProfile: target.adminProfile,
          adminProfileVersion: target.adminProfileVersion,
        },
        data: {
          adminProfile: "owner",
          adminProfileVersion: { increment: 1 },
        },
      });
      if (ownerChanged.count !== 1) throw new Error("Concurrent owner profile change");
      const revoked = await transaction.session.deleteMany({
        where: { userId: target.id },
      });
      sessionsRevoked += revoked.count;
      await transaction.adminProfileMutation.create({
        data: {
          operationId: input.operationId,
          kind: "bootstrap_owner",
          targetUserId: target.id,
          fromRole: "platform_admin",
          fromAdminProfile: target.adminProfile,
          toRole: "platform_admin",
          toAdminProfile: "owner",
          targetVersion: target.adminProfileVersion + 1,
          revokedSessions: revoked.count,
        },
      });
      await writeAuthAudit(
        {
          action: "admin.profile.bootstrap",
          targetUserId: target.id,
          outcome: "SUCCEEDED",
          correlationId: input.operationId,
          safeMetadata: {
            profile: "owner",
            operatorsAssigned: operatorTargets.length,
            revokedSessions: revoked.count,
            source: "owner_bootstrap_cli",
          },
        },
        transaction,
      );
      return {
        ownerUserId: target.id,
        operatorsAssigned: operatorTargets.length,
        sessionsRevoked,
        idempotent: false,
      };
    }, { isolationLevel: "Serializable", timeout: 15_000 });

    if ("error" in data) {
      return failure(
        data.error,
        data.error === "OWNER_ALREADY_EXISTS"
          ? "A different owner already exists"
          : data.error === "USER_NOT_FOUND"
            ? "The selected user does not exist"
            : "Owner must be an active platform administrator",
      );
    }
    return { success: true, data: { dryRun: false, ...data } };
  } catch {
    return failure("OWNER_BOOTSTRAP_FAILED", "Owner bootstrap failed without partial changes");
  }
}
