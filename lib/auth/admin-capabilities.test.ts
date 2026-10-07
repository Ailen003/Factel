import { describe, expect, it } from "vitest";
import {
  ADMIN_CAPABILITIES,
  ADMIN_CAPABILITY_MATRIX,
  adminProfileConsistencyError,
  hasAdminCapability,
} from "./admin-capabilities";

const owner = { role: "platform_admin", adminProfile: "owner" } as const;
const operator = { role: "platform_admin", adminProfile: "operator" } as const;
const trialUser = { role: "trial_user", adminProfile: null } as const;

describe("administrative capability policy", () => {
  it("grants every capability to the owner", () => {
    expect(ADMIN_CAPABILITY_MATRIX.owner).toEqual(ADMIN_CAPABILITIES);
    for (const capability of ADMIN_CAPABILITIES) {
      expect(hasAdminCapability(owner, capability)).toBe(true);
    }
  });

  it("grants trial operations and admission pause to the operator", () => {
    for (const capability of [
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
    ] as const) {
      expect(hasAdminCapability(operator, capability)).toBe(true);
    }
  });

  it("denies owner-only operations to the operator", () => {
    for (const capability of [
      "admin.manage",
      "admin.mfa.operator.recover",
      "ownership.transfer.initiate",
      "ownership.transfer.cancel",
      "platform.settings.update",
      "platform.admission.resume",
      "platform.global_limits.manage",
      "platform.global_pause.reopen",
    ] as const) {
      expect(hasAdminCapability(operator, capability)).toBe(false);
    }
  });

  it("grants no administrative capability to a trial user", () => {
    for (const capability of ADMIN_CAPABILITIES) {
      expect(hasAdminCapability(trialUser, capability)).toBe(false);
    }
  });

  it("rejects missing and role-incompatible profiles", () => {
    expect(adminProfileConsistencyError({
      role: "platform_admin",
      adminProfile: null,
    })).toBe("ADMIN_PROFILE_REQUIRED");
    expect(adminProfileConsistencyError({
      role: "trial_user",
      adminProfile: "owner",
    })).toBe("ADMIN_PROFILE_INCONSISTENT");
  });
});
