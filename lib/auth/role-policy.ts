import type { AppRole, UserStatus } from "./types";

export function roleChangeError(input: {
  actorId: string;
  targetId: string;
  currentRole: AppRole;
  requestedRole: AppRole;
  administratorCount: number;
}): "FORBIDDEN" | "LAST_ADMIN_REQUIRED" | null {
  if (input.actorId === input.targetId && input.currentRole !== input.requestedRole) {
    return "FORBIDDEN";
  }
  if (
    input.currentRole === "platform_admin" &&
    input.requestedRole !== "platform_admin" &&
    input.administratorCount <= 1
  ) {
    return "LAST_ADMIN_REQUIRED";
  }
  return null;
}

export function statusChangeError(input: {
  actorId: string;
  targetId: string;
  currentRole: AppRole;
  currentStatus: UserStatus;
  requestedStatus: UserStatus;
  activeAdministratorCount: number;
}): "CANNOT_DEACTIVATE_SELF" | "LAST_ADMIN_REQUIRED" | null {
  const isSuspending =
    input.currentStatus === "active" && input.requestedStatus === "suspended";
  if (!isSuspending) return null;
  if (input.actorId === input.targetId) return "CANNOT_DEACTIVATE_SELF";
  if (
    input.currentRole === "platform_admin" &&
    input.activeAdministratorCount <= 1
  ) {
    return "LAST_ADMIN_REQUIRED";
  }
  return null;
}

export function sessionRevocationError(input: {
  actorId: string;
  targetId: string;
}): "CANNOT_REVOKE_SELF" | null {
  return input.actorId === input.targetId ? "CANNOT_REVOKE_SELF" : null;
}

export function deletionError(input: {
  actorId: string;
  targetId: string;
  targetRole: AppRole;
}): "CANNOT_DELETE_SELF" | "TRIAL_USER_REQUIRED" | null {
  if (input.actorId === input.targetId) return "CANNOT_DELETE_SELF";
  return input.targetRole === "trial_user" ? null : "TRIAL_USER_REQUIRED";
}
