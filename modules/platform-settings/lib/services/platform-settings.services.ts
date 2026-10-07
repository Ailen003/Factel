import "server-only";

import type { AdminProfile } from "@/lib/auth/types";
import { AuthError } from "@/lib/auth/types";
import { requireAdminCapability } from "@/lib/auth/admin-authorization";
import { writeAuthAudit } from "@/lib/auth/audit";
import type { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import type { ServiceResponse } from "@/lib/api-responses";
import type {
  PlatformAdmissionMutationDto,
  PlatformSettings,
  PublicAccessContactSettings,
  UpdatePlatformContactEmailDto,
} from "../types/platform-settings.types";

const PLATFORM_SETTINGS_ID = "public-access";

const platformSettingsSelect = {
  accessContactEmail: true,
  accessRequestsEnabled: true,
  version: true,
  updatedAt: true,
} satisfies Prisma.PlatformSettingsSelect;

type SelectedPlatformSettings = Prisma.PlatformSettingsGetPayload<{
  select: typeof platformSettingsSelect;
}>;
type SettingsAction =
  | "platform.settings.update"
  | "platform.admission.pause"
  | "platform.admission.resume";

function mapSettings(
  settings: SelectedPlatformSettings | null,
  actorProfile: AdminProfile,
): PlatformSettings {
  return settings
    ? {
        accessContactEmail: settings.accessContactEmail,
        accessRequestsEnabled: settings.accessRequestsEnabled,
        version: settings.version,
        configured: true,
        updatedAt: settings.updatedAt.toISOString(),
        canUpdateContact: actorProfile === "owner",
        canPause: actorProfile === "owner" || actorProfile === "operator",
        canResume: actorProfile === "owner",
      }
    : {
        accessContactEmail: "",
        accessRequestsEnabled: false,
        version: 0,
        configured: false,
        updatedAt: null,
        canUpdateContact: actorProfile === "owner",
        canPause: actorProfile === "owner" || actorProfile === "operator",
        canResume: actorProfile === "owner",
      };
}

function failure<T>(code: string, message = code): ServiceResponse<T> {
  return { success: false, error: { code, message } };
}

function logUnexpected(operation: string, error: unknown): void {
  console.error("Platform settings operation failed", {
    operation,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
}

function isSettingsConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as { code?: unknown }).code === "P2002" ||
      (error as { code?: unknown }).code === "P2034")
  );
}

async function auditDenied(
  transaction: Prisma.TransactionClient,
  input: {
    action: SettingsAction;
    actorUserId: string;
    reason: string;
    expectedVersion: number;
  },
): Promise<{ error: string }> {
  await writeAuthAudit(
    {
      action: input.action,
      actorUserId: input.actorUserId,
      outcome: "DENIED",
      safeMetadata: {
        reason: input.reason,
        expectedVersion: input.expectedVersion,
      },
    },
    transaction,
  );
  return { error: input.reason };
}

export async function getPublicAccessContactSettings(): Promise<
  ServiceResponse<PublicAccessContactSettings>
> {
  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: PLATFORM_SETTINGS_ID },
      select: {
        accessContactEmail: true,
        accessRequestsEnabled: true,
      },
    });
    return {
      success: true,
      data: {
        available: Boolean(
          settings?.accessRequestsEnabled && settings.accessContactEmail,
        ),
      },
    };
  } catch (error) {
    logUnexpected("public-read", error);
    return failure("INTERNAL_ERROR", "Unable to load access contact settings");
  }
}

export async function getPlatformSettings(): Promise<
  ServiceResponse<PlatformSettings>
> {
  try {
    const actor = await requireAdminCapability("platform.settings.read");
    const settings = await prisma.$transaction(async (transaction) => {
      const selected = await transaction.platformSettings.findUnique({
        where: { id: PLATFORM_SETTINGS_ID },
        select: platformSettingsSelect,
      });
      await writeAuthAudit(
        {
          action: "platform.settings.read",
          actorUserId: actor.user.id,
          outcome: "SUCCEEDED",
          safeMetadata: {
            configured: Boolean(selected),
            accessRequestsEnabled: selected?.accessRequestsEnabled ?? false,
            version: selected?.version ?? 0,
          },
        },
        transaction,
      );
      return selected;
    });
    return {
      success: true,
      data: mapSettings(settings, actor.user.adminProfile!),
    };
  } catch (error) {
    if (error instanceof AuthError) return failure(error.code);
    logUnexpected("admin-read", error);
    return failure("INTERNAL_ERROR", "Unable to load platform settings");
  }
}

export async function updatePlatformContactEmail(
  dto: UpdatePlatformContactEmailDto,
): Promise<ServiceResponse<PlatformSettings>> {
  try {
    const actor = await requireAdminCapability("platform.settings.update");
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.platformSettings.findUnique({
        where: { id: PLATFORM_SETTINGS_ID },
        select: platformSettingsSelect,
      });
      if (current?.accessContactEmail === dto.accessContactEmail) {
        return { value: current };
      }
      if ((current?.version ?? 0) !== dto.expectedVersion) {
        return auditDenied(transaction, {
          action: "platform.settings.update",
          actorUserId: actor.user.id,
          reason: "SETTINGS_CONFLICT",
          expectedVersion: dto.expectedVersion,
        });
      }

      let saved: SelectedPlatformSettings;
      if (!current) {
        saved = await transaction.platformSettings.create({
          data: {
            id: PLATFORM_SETTINGS_ID,
            accessContactEmail: dto.accessContactEmail,
            accessRequestsEnabled: false,
            version: 1,
            updatedByUserId: actor.user.id,
          },
          select: platformSettingsSelect,
        });
      } else {
        const changed = await transaction.platformSettings.updateMany({
          where: { id: PLATFORM_SETTINGS_ID, version: dto.expectedVersion },
          data: {
            accessContactEmail: dto.accessContactEmail,
            version: { increment: 1 },
            updatedByUserId: actor.user.id,
          },
        });
        if (changed.count !== 1) {
          return auditDenied(transaction, {
            action: "platform.settings.update",
            actorUserId: actor.user.id,
            reason: "SETTINGS_CONFLICT",
            expectedVersion: dto.expectedVersion,
          });
        }
        saved = (await transaction.platformSettings.findUnique({
          where: { id: PLATFORM_SETTINGS_ID },
          select: platformSettingsSelect,
        }))!;
      }
      await writeAuthAudit(
        {
          action: "platform.settings.update",
          actorUserId: actor.user.id,
          outcome: "SUCCEEDED",
          safeMetadata: { version: saved.version },
        },
        transaction,
      );
      return { value: saved };
    }, { isolationLevel: "Serializable" });
    if ("error" in result) return failure(result.error);
    return {
      success: true,
      data: mapSettings(result.value, actor.user.adminProfile!),
    };
  } catch (error) {
    if (error instanceof AuthError) return failure(error.code);
    if (isSettingsConflict(error)) return failure("SETTINGS_CONFLICT");
    logUnexpected("contact-update", error);
    return failure("INTERNAL_ERROR", "Unable to update platform settings");
  }
}

async function mutateAccessRequests(
  dto: PlatformAdmissionMutationDto,
  input: {
    actorUserId: string;
    actorProfile: AdminProfile;
    desired: boolean;
    action: "platform.admission.pause" | "platform.admission.resume";
  },
): Promise<ServiceResponse<PlatformSettings>> {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.platformSettings.findUnique({
        where: { id: PLATFORM_SETTINGS_ID },
        select: platformSettingsSelect,
      });
      if ((current?.accessRequestsEnabled ?? false) === input.desired) {
        return { value: current };
      }
      if (!current) {
        return auditDenied(transaction, {
          action: input.action,
          actorUserId: input.actorUserId,
          reason: "SETTINGS_NOT_CONFIGURED",
          expectedVersion: dto.expectedVersion,
        });
      }
      if (current.version !== dto.expectedVersion) {
        return auditDenied(transaction, {
          action: input.action,
          actorUserId: input.actorUserId,
          reason: "SETTINGS_CONFLICT",
          expectedVersion: dto.expectedVersion,
        });
      }
      const changed = await transaction.platformSettings.updateMany({
        where: { id: PLATFORM_SETTINGS_ID, version: dto.expectedVersion },
        data: {
          accessRequestsEnabled: input.desired,
          version: { increment: 1 },
          updatedByUserId: input.actorUserId,
        },
      });
      if (changed.count !== 1) {
        return auditDenied(transaction, {
          action: input.action,
          actorUserId: input.actorUserId,
          reason: "SETTINGS_CONFLICT",
          expectedVersion: dto.expectedVersion,
        });
      }
      const saved = (await transaction.platformSettings.findUnique({
        where: { id: PLATFORM_SETTINGS_ID },
        select: platformSettingsSelect,
      }))!;
      await writeAuthAudit(
        {
          action: input.action,
          actorUserId: input.actorUserId,
          outcome: "SUCCEEDED",
          safeMetadata: { version: saved.version },
        },
        transaction,
      );
      return { value: saved };
    }, { isolationLevel: "Serializable" });
    if ("error" in result) return failure(result.error);
    return {
      success: true,
      data: mapSettings(result.value, input.actorProfile),
    };
  } catch (error) {
    if (isSettingsConflict(error)) return failure("SETTINGS_CONFLICT");
    logUnexpected(input.action, error);
    return failure("INTERNAL_ERROR", "Unable to update platform admission");
  }
}

export async function pauseAccessRequests(
  dto: PlatformAdmissionMutationDto,
): Promise<ServiceResponse<PlatformSettings>> {
  try {
    const actor = await requireAdminCapability("platform.admission.pause");
    return mutateAccessRequests(dto, {
      actorUserId: actor.user.id,
      actorProfile: actor.user.adminProfile!,
      desired: false,
      action: "platform.admission.pause",
    });
  } catch (error) {
    return error instanceof AuthError
      ? failure(error.code)
      : failure("INTERNAL_ERROR", "Unable to pause access requests");
  }
}

export async function resumeAccessRequests(
  dto: PlatformAdmissionMutationDto,
): Promise<ServiceResponse<PlatformSettings>> {
  try {
    const actor = await requireAdminCapability("platform.admission.resume");
    return mutateAccessRequests(dto, {
      actorUserId: actor.user.id,
      actorProfile: actor.user.adminProfile!,
      desired: true,
      action: "platform.admission.resume",
    });
  } catch (error) {
    return error instanceof AuthError
      ? failure(error.code)
      : failure("INTERNAL_ERROR", "Unable to resume access requests");
  }
}

export async function resolveAccessContactEmail(): Promise<
  ServiceResponse<{ contactEmail: string }>
> {
  try {
    const settings = await prisma.platformSettings.findFirst({
      where: {
        id: PLATFORM_SETTINGS_ID,
        accessRequestsEnabled: true,
      },
      select: { accessContactEmail: true },
    });
    return settings
      ? { success: true, data: { contactEmail: settings.accessContactEmail } }
      : failure("CONTACT_NOT_CONFIGURED", "Access requests are not available");
  } catch (error) {
    logUnexpected("contact-resolve", error);
    return failure("INTERNAL_ERROR", "Unable to prepare the access request");
  }
}
