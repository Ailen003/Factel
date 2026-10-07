import "server-only";

import type { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { auth } from "@/lib/auth/auth";
import { AuthError } from "@/lib/auth/types";
import { requireAdminCapability } from "@/lib/auth/admin-authorization";
import { writeAuthAudit } from "@/lib/auth/audit";
import type { ServiceResponse } from "@/lib/api-responses";
import type {
  CreateUserDto,
  EditUserDto,
  User,
  UserDetails,
  UserFiltersDto,
  UserMutationResult,
  ProvisionedTrialUser,
  UserStatusResult,
  UsersResponse,
  UsersStats,
} from "../types/user.types";
import {
  deletionError,
  sessionRevocationError,
  statusChangeError,
} from "@/lib/auth/role-policy";
import type { UserStatus } from "@/lib/auth/types";
import { initializeWorkspaceCredits } from "@/modules/conversations/lib/services/credit.services";
import { temporaryPasswordExpiresAt } from "@/lib/auth/trial-policy";
import { generateTemporaryPassword } from "@/lib/auth/temporary-credential";
import type { TemporaryCredentialIssuanceMetadata } from "../types/temporary-credential-reissue.types";
import { adminTargetPolicyError } from "./admin-target-policy";

const temporaryCredentialIssuanceSelect = {
  id: true,
  version: true,
  purpose: true,
  reason: true,
  status: true,
  preparedAt: true,
  issuedAt: true,
  expiresAt: true,
  deliveredAt: true,
  deliveryChannel: true,
} satisfies Prisma.TemporaryCredentialIssuanceSelect;

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  adminProfile: true,
  adminProfileVersion: true,
  twoFactorEnabled: true,
  twoFactor: { select: { verified: true } },
  status: true,
  locale: true,
  initialCreditAllocation: true,
  temporaryPasswordChangeRequired: true,
  temporaryPasswordExpiresAt: true,
  temporaryPasswordPurpose: true,
  temporaryCredentialVersion: true,
  trialActivatedAt: true,
  trialExpiresAt: true,
  createdAt: true,
  updatedAt: true,
  temporaryCredentialTargets: {
    orderBy: { version: "desc" as const },
    take: 1,
    select: temporaryCredentialIssuanceSelect,
  },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

function mapUser(user: SelectedUser): User {
  const latest = user.temporaryCredentialTargets?.[0];
  const latestTemporaryCredentialIssuance: TemporaryCredentialIssuanceMetadata | null = latest
    ? {
        id: latest.id,
        version: latest.version,
        purpose: latest.purpose,
        reason: latest.reason,
        status: latest.status,
        preparedAt: latest.preparedAt.toISOString(),
        issuedAt: latest.issuedAt?.toISOString() ?? null,
        expiresAt: latest.expiresAt?.toISOString() ?? null,
        deliveredAt: latest.deliveredAt?.toISOString() ?? null,
        deliveryChannel: latest.deliveryChannel,
      }
    : null;
  return {
    id: user.id,
    email: user.email,
    fullName: user.name,
    role: user.role,
    adminProfile: user.adminProfile ?? null,
    adminProfileVersion: user.adminProfileVersion ?? 0,
    twoFactorEnabled: user.twoFactorEnabled === true,
    twoFactorVerified: user.twoFactor?.verified === true,
    status: user.status === "suspended" ? "suspended" : "active",
    locale: user.locale,
    initialCreditAllocation: user.initialCreditAllocation,
    temporaryPasswordChangeRequired: user.temporaryPasswordChangeRequired,
    temporaryPasswordExpiresAt: user.temporaryPasswordExpiresAt?.toISOString() ?? null,
    temporaryPasswordPurpose: user.temporaryPasswordPurpose,
    temporaryCredentialVersion: user.temporaryCredentialVersion ?? 0,
    latestTemporaryCredentialIssuance,
    trialActivatedAt: user.trialActivatedAt?.toISOString() ?? null,
    trialExpiresAt: user.trialExpiresAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function failure<T>(code: string, message: string): ServiceResponse<T> {
  return { success: false, error: { code, message } };
}

function authFailure<T>(
  error: unknown,
): Extract<ServiceResponse<T>, { success: false }> | null {
  if (!(error instanceof AuthError)) return null;
  return { success: false, error: { code: error.code, message: error.code } };
}

function logUnexpected(operation: string, error: unknown): void {
  console.error("User administration operation failed", {
    operation,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
}

function isForeignKeyConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2003"
  );
}

export async function getAllUsers(
  filters: UserFiltersDto,
): Promise<ServiceResponse<UsersResponse>> {
  try {
    await requireAdminCapability("trial.read");
    const where: Prisma.UserWhereInput = {
      status: filters.status ?? { in: ["active", "suspended"] },
      role: filters.role,
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { email: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.UserOrderByWithRelationInput =
      filters.sortBy === "fullName" ? { name: filters.sortOrder }
      : filters.sortBy === "email" ? { email: filters.sortOrder }
      : filters.sortBy === "role" ? { role: filters.sortOrder }
      : filters.sortBy === "status" ? { status: filters.sortOrder }
      : { createdAt: filters.sortOrder };
    const { records, total, page } = await prisma.$transaction(
      async (transaction) => {
        const total = await transaction.user.count({ where });
        const totalPages = Math.max(1, Math.ceil(total / filters.limit));
        const page = Math.min(filters.page, totalPages);
        const records = await transaction.user.findMany({
          where,
          select: userSelect,
          orderBy,
          skip: (page - 1) * filters.limit,
          take: filters.limit,
        });

        return { records, total, page };
      },
    );
    return {
      success: true,
      data: {
        users: records.map(mapUser),
        pagination: {
          page,
          limit: filters.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / filters.limit)),
        },
      },
    };
  } catch (error) {
    const authResult = authFailure<UsersResponse>(error);
    if (authResult) return authResult;
    logUnexpected("list", error);
    return failure("INTERNAL_ERROR", "Unable to list users");
  }
}

export async function getUserById(userId: string): Promise<ServiceResponse<UserDetails>> {
  try {
    await requireAdminCapability("trial.read");
    const record = await prisma.user.findFirst({
      where: { id: userId, status: { in: ["active", "suspended"] } },
      select: userSelect,
    });
    return record
      ? { success: true, data: mapUser(record) }
      : failure("USER_NOT_FOUND", "User not found");
  } catch (error) {
    const authResult = authFailure<UserDetails>(error);
    if (authResult) return authResult;
    logUnexpected("get", error);
    return failure("INTERNAL_ERROR", "Unable to load user");
  }
}

export async function getUsersStats(): Promise<ServiceResponse<UsersStats>> {
  try {
    await requireAdminCapability("trial.read");
    const [totalUsers, platformAdmins, trialUsers, active, suspended] =
      await prisma.$transaction([
        prisma.user.count({ where: { status: { in: ["active", "suspended"] } } }),
        prisma.user.count({ where: { role: "platform_admin", status: { in: ["active", "suspended"] } } }),
        prisma.user.count({ where: { role: "trial_user", status: { in: ["active", "suspended"] } } }),
        prisma.user.count({ where: { status: "active" } }),
        prisma.user.count({ where: { status: "suspended" } }),
      ]);
    return { success: true, data: { totalUsers, platformAdmins, trialUsers, active, suspended } };
  } catch (error) {
    const authResult = authFailure<UsersStats>(error);
    if (authResult) return authResult;
    logUnexpected("stats", error);
    return failure("INTERNAL_ERROR", "Unable to load user statistics");
  }
}

async function compensateProvisioning(userId: string): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await transaction.workspace.deleteMany({ where: { ownerId: userId } });
    await transaction.user.deleteMany({ where: { id: userId } });
  });
}

export async function createUser(dto: CreateUserDto): Promise<ServiceResponse<ProvisionedTrialUser>> {
  let createdUserId: string | null = null;
  let actorUserId: string | null = null;
  try {
    const actor = await requireAdminCapability("trial.create");
    actorUserId = actor.user.id;
    const duplicate = await prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (duplicate) {
      await writeAuthAudit({
        action: "user.create",
        actorUserId,
        outcome: "DENIED",
        safeMetadata: { reason: "EMAIL_ALREADY_EXISTS" },
      });
      return failure("EMAIL_ALREADY_EXISTS", "Email already exists");
    }

    const temporaryPassword = generateTemporaryPassword();
    const result = await auth.api.createUser({
      body: {
        name: dto.name,
        email: dto.email,
        password: temporaryPassword,
        role: "trial_user",
      },
    });
    createdUserId =
      (result as { user?: { id?: string }; id?: string }).user?.id ??
      (result as { id?: string }).id ??
      null;
    if (!createdUserId) throw new Error("Created user identifier missing");

    const provisionedAt = new Date();
    const temporaryCredentialExpiresAt = temporaryPasswordExpiresAt(provisionedAt);
    const verified = await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: createdUserId! },
        data: {
          role: "trial_user",
          status: "active",
          emailVerified: true,
          temporaryPasswordChangeRequired: true,
          temporaryPasswordExpiresAt: temporaryCredentialExpiresAt,
          temporaryPasswordPurpose: "activation",
          trialActivatedAt: null,
          trialExpiresAt: null,
          locale: dto.locale,
          initialCreditAllocation: dto.initialCreditAllocation,
        },
      });

      const record = await transaction.user.findUnique({
        where: { id: createdUserId! },
        select: {
          ...userSelect,
          accounts: {
            where: { providerId: "credential", password: { not: null } },
            select: { id: true },
          },
          workspace: { select: { id: true } },
        },
      });
      if (!record || record.accounts.length !== 1 || !record.workspace) {
        throw new Error("Provisioning verification failed");
      }

      await initializeWorkspaceCredits(transaction, record.workspace.id);

      await writeAuthAudit(
        {
          action: "user.create",
          actorUserId,
          targetUserId: createdUserId,
          outcome: "SUCCEEDED",
          safeMetadata: {
            role: "trial_user",
            temporaryPasswordExpiresAt:
              temporaryCredentialExpiresAt.toISOString(),
          },
        },
        transaction,
      );
      return record;
    });
    return {
      success: true,
      data: {
        user: mapUser(verified),
        temporaryPassword,
        temporaryPasswordExpiresAt: temporaryCredentialExpiresAt.toISOString(),
      },
    };
  } catch (error) {
    const authResult = authFailure<ProvisionedTrialUser>(error);
    if (authResult) {
      try {
        await writeAuthAudit({
          action: "user.create",
          actorUserId,
          outcome: "DENIED",
          safeMetadata: { reason: authResult.error.code },
        });
      } catch (auditError) {
        logUnexpected("create-denied-audit", auditError);
        return failure("INTERNAL_ERROR", "Unable to audit user creation denial");
      }
      return authResult;
    }
    let compensation = "not-owned";
    if (createdUserId) {
      try {
        await compensateProvisioning(createdUserId);
        compensation = "succeeded";
      } catch (compensationError) {
        compensation = "failed";
        logUnexpected("provision-compensation", compensationError);
      }
    }
    try {
      await writeAuthAudit({
        action: "user.create",
        actorUserId,
        targetUserId: createdUserId,
        outcome: "FAILED",
        safeMetadata: { reason: "PROVISIONING_FAILED", compensation },
      });
    } catch (auditError) {
      logUnexpected("create-failed-audit", auditError);
    }
    logUnexpected("create", error);
    return failure("PROVISIONING_FAILED", "User provisioning failed");
  }
}

export async function editUser(
  userId: string,
  dto: EditUserDto,
): Promise<ServiceResponse<UserDetails>> {
  let actorUserId: string | null = null;
  try {
    const actor = await requireAdminCapability("trial.update");
    actorUserId = actor.user.id;
    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.user.findFirst({
        where: { id: userId, status: { in: ["active", "suspended"] } },
        select: userSelect,
      });
      if (!existing) {
        await writeAuthAudit(
          {
            action: "user.update",
            actorUserId,
            targetUserId: userId,
            outcome: "FAILED",
            safeMetadata: { reason: "USER_NOT_FOUND" },
          },
          transaction,
        );
        return { error: "USER_NOT_FOUND" as const };
      }
      const policyError = adminTargetPolicyError({
        actorProfile: actor.user.adminProfile,
        targetRole: existing.role,
        targetProfile: existing.adminProfile,
        operation: "edit",
      });
      if (policyError) {
        await writeAuthAudit(
          {
            action: "user.update",
            actorUserId,
            targetUserId: userId,
            outcome: "DENIED",
            safeMetadata: { reason: policyError },
          },
          transaction,
        );
        return { error: policyError };
      }
      const updated = await transaction.user.update({
        where: { id: userId },
        data: { name: dto.name, locale: dto.locale },
        select: userSelect,
      });
      await writeAuthAudit(
        {
          action: "user.update",
          actorUserId,
          targetUserId: userId,
          outcome: "SUCCEEDED",
          safeMetadata: { locale: updated.locale },
        },
        transaction,
      );
      return { updated };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      const code = result.error ?? "INTERNAL_ERROR";
      return failure(code, code);
    }
    return { success: true, data: mapUser(result.updated) };
  } catch (error) {
    const authResult = authFailure<UserDetails>(error);
    if (authResult) {
      try {
        await writeAuthAudit({
          action: "user.update",
          actorUserId,
          targetUserId: userId,
          outcome: "DENIED",
          safeMetadata: { reason: authResult.error.code },
        });
      } catch (auditError) {
        logUnexpected("edit-denied-audit", auditError);
        return failure("INTERNAL_ERROR", "Unable to audit user update denial");
      }
      return authResult;
    }
    try {
      await writeAuthAudit({
        action: "user.update",
        actorUserId,
        targetUserId: userId,
        outcome: "FAILED",
        safeMetadata: { reason: "INTERNAL_ERROR" },
      });
    } catch (auditError) {
      logUnexpected("edit-failed-audit", auditError);
    }
    logUnexpected("edit", error);
    return failure("INTERNAL_ERROR", "Unable to update user");
  }
}

async function hasManagedDomainData(
  transaction: Prisma.TransactionClient,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const workspace = await transaction.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      _count: {
        select: {
          clients: true,
          serviceRequests: true,
          conversations: true,
          processingRuns: true,
          proposalRevisions: true,
          recordPlans: true,
          operationReceipts: true,
          creditEntries: true,
          creditReservations: true,
          assistantThreads: true,
          cleanupTasks: true,
          outboxEvents: true,
          uploadGrants: true,
          providerInvocations: true,
        },
      },
    },
  });
  if (!workspace) return true;

  const userReferences = await transaction.user.findUnique({
    where: { id: userId },
    select: {
      _count: {
        select: {
          createdClients: true,
          updatedClients: true,
          createdRequests: true,
          updatedRequests: true,
          createdRecordPlans: true,
          approvals: true,
          operationReceipts: true,
          assistantThreads: true,
        },
      },
    },
  });
  if (!userReferences) return true;

  return [...Object.values(workspace._count), ...Object.values(userReferences._count)]
    .some((count) => count > 0);
}

export async function setUserStatus(
  userId: string,
  requestedStatus: UserStatus,
): Promise<ServiceResponse<UserStatusResult>> {
  let actorUserId: string | null = null;
  try {
    const actor = await requireAdminCapability("trial.suspend");
    actorUserId = actor.user.id;
    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.user.findFirst({
        where: { id: userId, status: { in: ["active", "suspended"] } },
        select: userSelect,
      });
      if (!existing) {
        await writeAuthAudit({
          action: "user.status_change",
          actorUserId,
          targetUserId: userId,
          outcome: "FAILED",
          safeMetadata: { reason: "USER_NOT_FOUND" },
        }, transaction);
        return { error: "USER_NOT_FOUND" as const };
      }

      const targetPolicyError = adminTargetPolicyError({
        actorProfile: actor.user.adminProfile,
        targetRole: existing.role,
        targetProfile: existing.adminProfile,
        operation: "lifecycle",
      });
      if (targetPolicyError) {
        await writeAuthAudit({
          action: "user.status_change",
          actorUserId,
          targetUserId: userId,
          outcome: "DENIED",
          safeMetadata: { reason: targetPolicyError },
        }, transaction);
        return { error: targetPolicyError };
      }

      const currentStatus: UserStatus =
        existing.status === "suspended" ? "suspended" : "active";
      const activeAdministratorCount =
        existing.role === "platform_admin" && requestedStatus === "suspended"
          ? await transaction.user.count({
              where: { role: "platform_admin", status: "active" },
            })
          : 0;
      const policyError = statusChangeError({
        actorId: actor.user.id,
        targetId: userId,
        currentRole: existing.role,
        currentStatus,
        requestedStatus,
        activeAdministratorCount,
      });
      if (policyError) {
        await writeAuthAudit({
          action: "user.status_change",
          actorUserId,
          targetUserId: userId,
          outcome: "DENIED",
          safeMetadata: { reason: policyError },
        }, transaction);
        return { error: policyError };
      }

      if (requestedStatus === "active") {
        const readyAccount = await transaction.user.findFirst({
          where: {
            id: userId,
            accounts: { some: { providerId: "credential", password: { not: null } } },
            workspace: { is: { lifecycle: "ACTIVE" } },
          },
          select: { id: true },
        });
        if (!readyAccount) {
          await writeAuthAudit({
            action: "user.status_change",
            actorUserId,
            targetUserId: userId,
            outcome: "DENIED",
            safeMetadata: { reason: "ACCOUNT_NOT_READY" },
          }, transaction);
          return { error: "ACCOUNT_NOT_READY" as const };
        }
      }

      const revokedSessions = requestedStatus === "suspended"
        ? (await transaction.session.deleteMany({ where: { userId } })).count
        : 0;
      const updated = currentStatus === requestedStatus
        ? existing
        : await transaction.user.update({
            where: { id: userId },
            data: { status: requestedStatus },
            select: userSelect,
          });
      await writeAuthAudit({
        action: "user.status_change",
        actorUserId,
        targetUserId: userId,
        outcome: "SUCCEEDED",
        safeMetadata: {
          from: currentStatus,
          to: requestedStatus,
          changed: currentStatus !== requestedStatus,
          revokedSessions,
        },
      }, transaction);
      return { updated, revokedSessions };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      const code = result.error ?? "INTERNAL_ERROR";
      return failure(code, code);
    }
    return {
      success: true,
      data: { user: mapUser(result.updated), revokedSessions: result.revokedSessions },
    };
  } catch (error) {
    const authResult = authFailure<UserStatusResult>(error);
    if (authResult) {
      try {
        await writeAuthAudit({
          action: "user.status_change",
          actorUserId,
          targetUserId: userId,
          outcome: "DENIED",
          safeMetadata: { reason: authResult.error.code },
        });
      } catch (auditError) {
        logUnexpected("status-change-denied-audit", auditError);
        return failure("INTERNAL_ERROR", "Unable to audit status change denial");
      }
      return authResult;
    }
    try {
      await writeAuthAudit({
        action: "user.status_change",
        actorUserId,
        targetUserId: userId,
        outcome: "FAILED",
        safeMetadata: { reason: "INTERNAL_ERROR" },
      });
    } catch (auditError) {
      logUnexpected("status-change-failed-audit", auditError);
    }
    logUnexpected("status-change", error);
    return failure("INTERNAL_ERROR", "Unable to change user status");
  }
}

export async function revokeUserSessions(
  userId: string,
): Promise<ServiceResponse<UserMutationResult>> {
  let actorUserId: string | null = null;
  try {
    const actor = await requireAdminCapability("trial.sessions.revoke");
    actorUserId = actor.user.id;
    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.user.findFirst({
        where: { id: userId, status: { in: ["active", "suspended"] } },
        select: { id: true, role: true, adminProfile: true },
      });
      if (!existing) {
        await writeAuthAudit({
          action: "user.sessions_revoke",
          actorUserId,
          targetUserId: userId,
          outcome: "FAILED",
          safeMetadata: { reason: "USER_NOT_FOUND" },
        }, transaction);
        return { error: "USER_NOT_FOUND" as const };
      }
      const targetPolicyError = adminTargetPolicyError({
        actorProfile: actor.user.adminProfile,
        targetRole: existing.role,
        targetProfile: existing.adminProfile,
        operation: "sessions",
      });
      if (targetPolicyError) {
        await writeAuthAudit({
          action: "user.sessions_revoke",
          actorUserId,
          targetUserId: userId,
          outcome: "DENIED",
          safeMetadata: { reason: targetPolicyError },
        }, transaction);
        return { error: targetPolicyError };
      }
      const policyError = sessionRevocationError({
        actorId: actor.user.id,
        targetId: userId,
      });
      if (policyError) {
        await writeAuthAudit({
          action: "user.sessions_revoke",
          actorUserId,
          targetUserId: userId,
          outcome: "DENIED",
          safeMetadata: { reason: policyError },
        }, transaction);
        return { error: policyError };
      }

      const revokedSessions = (
        await transaction.session.deleteMany({ where: { userId } })
      ).count;
      await writeAuthAudit({
        action: "user.sessions_revoke",
        actorUserId,
        targetUserId: userId,
        outcome: "SUCCEEDED",
        safeMetadata: { revokedSessions },
      }, transaction);
      return { revokedSessions };
    });

    if ("error" in result) {
      const code = result.error ?? "INTERNAL_ERROR";
      return failure(code, code);
    }
    return { success: true, data: { userId, revokedSessions: result.revokedSessions } };
  } catch (error) {
    const authResult = authFailure<UserMutationResult>(error);
    if (authResult) {
      try {
        await writeAuthAudit({
          action: "user.sessions_revoke",
          actorUserId,
          targetUserId: userId,
          outcome: "DENIED",
          safeMetadata: { reason: authResult.error.code },
        });
      } catch (auditError) {
        logUnexpected("sessions-revoke-denied-audit", auditError);
        return failure("INTERNAL_ERROR", "Unable to audit session revocation denial");
      }
      return authResult;
    }
    try {
      await writeAuthAudit({
        action: "user.sessions_revoke",
        actorUserId,
        targetUserId: userId,
        outcome: "FAILED",
        safeMetadata: { reason: "INTERNAL_ERROR" },
      });
    } catch (auditError) {
      logUnexpected("sessions-revoke-failed-audit", auditError);
    }
    logUnexpected("sessions-revoke", error);
    return failure("INTERNAL_ERROR", "Unable to revoke user sessions");
  }
}

export async function deleteManagedUser(
  userId: string,
): Promise<ServiceResponse<UserMutationResult>> {
  let actorUserId: string | null = null;
  try {
    const actor = await requireAdminCapability("trial.delete");
    actorUserId = actor.user.id;
    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.user.findFirst({
        where: { id: userId, status: { in: ["active", "suspended"] } },
        select: {
          id: true,
          role: true,
          adminProfile: true,
          workspace: { select: { id: true } },
        },
      });
      if (!existing) {
        await writeAuthAudit({
          action: "user.delete",
          actorUserId,
          targetUserId: userId,
          outcome: "FAILED",
          safeMetadata: { reason: "USER_NOT_FOUND" },
        }, transaction);
        return { error: "USER_NOT_FOUND" as const };
      }
      const targetPolicyError = adminTargetPolicyError({
        actorProfile: actor.user.adminProfile,
        targetRole: existing.role,
        targetProfile: existing.adminProfile,
        operation: "delete",
      });
      if (targetPolicyError) {
        await writeAuthAudit({
          action: "user.delete",
          actorUserId,
          targetUserId: userId,
          outcome: "DENIED",
          safeMetadata: { reason: targetPolicyError },
        }, transaction);
        return { error: targetPolicyError };
      }
      const policyError = deletionError({
        actorId: actor.user.id,
        targetId: userId,
        targetRole: existing.role,
      });
      if (policyError) {
        await writeAuthAudit({
          action: "user.delete",
          actorUserId,
          targetUserId: userId,
          outcome: "DENIED",
          safeMetadata: { reason: policyError },
        }, transaction);
        return { error: policyError };
      }
      if (
        !existing.workspace ||
        await hasManagedDomainData(transaction, userId, existing.workspace.id)
      ) {
        await writeAuthAudit({
          action: "user.delete",
          actorUserId,
          targetUserId: userId,
          outcome: "DENIED",
          safeMetadata: { reason: "ACCOUNT_HAS_MANAGED_DATA" },
        }, transaction);
        return { error: "ACCOUNT_HAS_MANAGED_DATA" as const };
      }

      await transaction.workspace.update({
        where: { id: existing.workspace.id },
        data: { lifecycle: "DELETING" },
      });
      const revokedSessions = (
        await transaction.session.deleteMany({ where: { userId } })
      ).count;
      await transaction.auditEvent.updateMany({
        where: { workspaceId: existing.workspace.id },
        data: { workspaceId: null },
      });
      await transaction.workspace.delete({ where: { id: existing.workspace.id } });
      await transaction.user.delete({ where: { id: userId } });
      await writeAuthAudit({
        action: "user.delete",
        actorUserId,
        targetUserId: userId,
        outcome: "SUCCEEDED",
        safeMetadata: { revokedSessions },
      }, transaction);
      return { revokedSessions };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      const code = result.error ?? "INTERNAL_ERROR";
      return failure(code, code);
    }
    return { success: true, data: { userId, revokedSessions: result.revokedSessions } };
  } catch (error) {
    if (isForeignKeyConflict(error)) {
      try {
        await writeAuthAudit({
          action: "user.delete",
          actorUserId,
          targetUserId: userId,
          outcome: "DENIED",
          safeMetadata: { reason: "ACCOUNT_HAS_MANAGED_DATA" },
        });
      } catch (auditError) {
        logUnexpected("delete-blocked-audit", auditError);
        return failure("INTERNAL_ERROR", "Unable to audit blocked account deletion");
      }
      return failure("ACCOUNT_HAS_MANAGED_DATA", "Account contains managed data");
    }
    const authResult = authFailure<UserMutationResult>(error);
    if (authResult) {
      try {
        await writeAuthAudit({
          action: "user.delete",
          actorUserId,
          targetUserId: userId,
          outcome: "DENIED",
          safeMetadata: { reason: authResult.error.code },
        });
      } catch (auditError) {
        logUnexpected("delete-denied-audit", auditError);
        return failure("INTERNAL_ERROR", "Unable to audit account deletion denial");
      }
      return authResult;
    }
    try {
      await writeAuthAudit({
        action: "user.delete",
        actorUserId,
        targetUserId: userId,
        outcome: "FAILED",
        safeMetadata: { reason: "INTERNAL_ERROR" },
      });
    } catch (auditError) {
      logUnexpected("delete-failed-audit", auditError);
    }
    logUnexpected("delete", error);
    return failure("INTERNAL_ERROR", "Unable to delete user");
  }
}
