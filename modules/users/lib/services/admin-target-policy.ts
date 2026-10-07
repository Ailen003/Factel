import type { AdminProfile, AppRole } from "@/lib/auth/types";

export type AdminTargetOperation =
  | "edit"
  | "lifecycle"
  | "sessions"
  | "delete"
  | "credential";

export function adminTargetPolicyError(input: {
  actorProfile: AdminProfile | null;
  targetRole: AppRole;
  targetProfile: AdminProfile | null;
  operation: AdminTargetOperation;
}): "ADMIN_TARGET_FORBIDDEN" | "OWNER_PROTECTED" | null {
  if (input.targetRole !== "platform_admin") return null;
  if (input.actorProfile !== "owner" || input.targetProfile === null) {
    return "ADMIN_TARGET_FORBIDDEN";
  }
  if (input.targetProfile === "owner" && input.operation !== "edit") {
    return "OWNER_PROTECTED";
  }
  return input.operation === "edit" ? null : "ADMIN_TARGET_FORBIDDEN";
}
