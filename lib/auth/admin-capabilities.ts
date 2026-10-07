import type { AdminProfile, AppRole } from "./types";

export const ADMIN_CAPABILITIES = [
  "trial.read",
  "trial.create",
  "trial.update",
  "trial.credentials.reissue",
  "trial.credentials.confirm_delivery",
  "trial.suspend",
  "trial.sessions.revoke",
  "trial.delete",
  "admin.manage",
  "admin.mfa.operator.recover",
  "ownership.transfer.initiate",
  "ownership.transfer.cancel",
  "platform.settings.read",
  "platform.settings.update",
  "platform.admission.pause",
  "platform.admission.resume",
  "platform.global_limits.manage",
  "platform.global_pause.reopen",
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

const operatorCapabilities = [
  "trial.read",
  "trial.create",
  "trial.update",
  "trial.credentials.reissue",
  "trial.credentials.confirm_delivery",
  "trial.suspend",
  "trial.sessions.revoke",
  "trial.delete",
  "platform.settings.read",
  "platform.admission.pause",
] as const satisfies readonly AdminCapability[];

export const ADMIN_CAPABILITY_MATRIX: Record<
  AdminProfile,
  readonly AdminCapability[]
> = {
  owner: ADMIN_CAPABILITIES,
  operator: operatorCapabilities,
};

export interface AdminCapabilityActor {
  role: AppRole;
  adminProfile: AdminProfile | null;
}

export function adminProfileConsistencyError(
  actor: AdminCapabilityActor,
): "ADMIN_PROFILE_REQUIRED" | "ADMIN_PROFILE_INCONSISTENT" | null {
  if (actor.role === "platform_admin") {
    return actor.adminProfile ? null : "ADMIN_PROFILE_REQUIRED";
  }
  return actor.adminProfile === null ? null : "ADMIN_PROFILE_INCONSISTENT";
}

export function hasAdminCapability(
  actor: AdminCapabilityActor,
  capability: AdminCapability,
): boolean {
  if (adminProfileConsistencyError(actor) || !actor.adminProfile) return false;
  return ADMIN_CAPABILITY_MATRIX[actor.adminProfile].includes(capability);
}
