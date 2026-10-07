import { describe, expect, it } from "vitest";
import {
  deletionError,
  roleChangeError,
  sessionRevocationError,
  statusChangeError,
} from "@/lib/auth/role-policy";
import { adminTargetPolicyError } from "./admin-target-policy";

describe("administrator target policy", () => {
  it("denies operators from mutating administrator targets", () => {
    expect(adminTargetPolicyError({
      actorProfile: "operator",
      targetRole: "platform_admin",
      targetProfile: "operator",
      operation: "edit",
    })).toBe("ADMIN_TARGET_FORBIDDEN");
  });

  it("allows owner edits but protects owner lifecycle and sessions", () => {
    expect(adminTargetPolicyError({
      actorProfile: "owner",
      targetRole: "platform_admin",
      targetProfile: "owner",
      operation: "edit",
    })).toBeNull();
    expect(adminTargetPolicyError({
      actorProfile: "owner",
      targetRole: "platform_admin",
      targetProfile: "owner",
      operation: "sessions",
    })).toBe("OWNER_PROTECTED");
  });

  it("requires the profile transition flow for non-edit actions on operators", () => {
    expect(adminTargetPolicyError({
      actorProfile: "owner",
      targetRole: "platform_admin",
      targetProfile: "operator",
      operation: "sessions",
    })).toBe("ADMIN_TARGET_FORBIDDEN");
    expect(adminTargetPolicyError({
      actorProfile: "owner",
      targetRole: "platform_admin",
      targetProfile: "operator",
      operation: "lifecycle",
    })).toBe("ADMIN_TARGET_FORBIDDEN");
  });
});

describe("administrative role policy", () => {
  it("rejects self-demotion", () => {
    expect(roleChangeError({ actorId: "a", targetId: "a", currentRole: "platform_admin", requestedRole: "trial_user", administratorCount: 2 })).toBe("FORBIDDEN");
  });

  it("rejects demoting the final administrator", () => {
    expect(roleChangeError({ actorId: "other", targetId: "a", currentRole: "platform_admin", requestedRole: "trial_user", administratorCount: 1 })).toBe("LAST_ADMIN_REQUIRED");
  });

  it("allows a different administrator to demote when another remains", () => {
    expect(roleChangeError({ actorId: "other", targetId: "a", currentRole: "platform_admin", requestedRole: "trial_user", administratorCount: 2 })).toBeNull();
  });
});

describe("administrative lifecycle policy", () => {
  it("rejects self-suspension and suspending the final active administrator", () => {
    expect(statusChangeError({ actorId: "a", targetId: "a", currentRole: "platform_admin", currentStatus: "active", requestedStatus: "suspended", activeAdministratorCount: 2 })).toBe("CANNOT_DEACTIVATE_SELF");
    expect(statusChangeError({ actorId: "other", targetId: "a", currentRole: "platform_admin", currentStatus: "active", requestedStatus: "suspended", activeAdministratorCount: 1 })).toBe("LAST_ADMIN_REQUIRED");
  });

  it("allows activation and suspending another account when an administrator remains", () => {
    expect(statusChangeError({ actorId: "a", targetId: "b", currentRole: "platform_admin", currentStatus: "active", requestedStatus: "suspended", activeAdministratorCount: 2 })).toBeNull();
    expect(statusChangeError({ actorId: "a", targetId: "b", currentRole: "trial_user", currentStatus: "suspended", requestedStatus: "active", activeAdministratorCount: 0 })).toBeNull();
  });

  it("protects self-revocation and administrator deletion", () => {
    expect(sessionRevocationError({ actorId: "a", targetId: "a" })).toBe("CANNOT_REVOKE_SELF");
    expect(deletionError({ actorId: "a", targetId: "b", targetRole: "platform_admin" })).toBe("TRIAL_USER_REQUIRED");
    expect(deletionError({ actorId: "a", targetId: "b", targetRole: "trial_user" })).toBeNull();
  });
});
