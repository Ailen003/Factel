import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  begin: vi.fn(),
  verifyEnrollment: vi.fn(),
  verifyTotp: vi.fn(),
  verifyBackup: vi.fn(),
  regenerate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../services/two-factor.services", () => ({
  getTwoFactorStatus: mocks.status,
  beginTwoFactorEnrollment: mocks.begin,
  verifyTwoFactorEnrollment: mocks.verifyEnrollment,
  verifyTwoFactorTotpChallenge: mocks.verifyTotp,
  verifyTwoFactorBackupChallenge: mocks.verifyBackup,
  regenerateTwoFactorBackupCodes: mocks.regenerate,
}));

import {
  beginTwoFactorEnrollmentAction,
  regenerateTwoFactorBackupCodesAction,
  verifyTwoFactorBackupChallengeAction,
  verifyTwoFactorEnrollmentAction,
  verifyTwoFactorTotpChallengeAction,
} from "./two-factor.actions";

describe("two-factor server actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects malformed transport input before calling a service", async () => {
    await expect(verifyTwoFactorEnrollmentAction({ code: "12" })).resolves.toMatchObject({
      success: false,
      error: { code: "INVALID_INPUT" },
    });
    await expect(regenerateTwoFactorBackupCodesAction({
      password: "password",
      confirmed: false as true,
    })).resolves.toMatchObject({ success: false, error: { code: "INVALID_INPUT" } });
    expect(mocks.verifyEnrollment).not.toHaveBeenCalled();
    expect(mocks.regenerate).not.toHaveBeenCalled();
  });

  it("normalizes TOTP and delegates only typed commands", async () => {
    mocks.verifyTotp.mockResolvedValue({ success: true, data: { returnTo: "/users" } });
    await verifyTwoFactorTotpChallengeAction({ code: " 123 456 ", returnTo: "/users" });
    expect(mocks.verifyTotp).toHaveBeenCalledWith({ code: "123456", returnTo: "/users" });
  });

  it("delegates enrollment, backup challenge and confirmed regeneration", async () => {
    mocks.begin.mockResolvedValue({ success: true, data: {} });
    mocks.verifyBackup.mockResolvedValue({ success: true, data: {} });
    mocks.regenerate.mockResolvedValue({ success: true, data: {} });

    await beginTwoFactorEnrollmentAction({ password: "password" });
    await verifyTwoFactorBackupChallengeAction({ code: " backup ", returnTo: "/settings" });
    await regenerateTwoFactorBackupCodesAction({ password: "password", confirmed: true });

    expect(mocks.begin).toHaveBeenCalledWith({ password: "password" });
    expect(mocks.verifyBackup).toHaveBeenCalledWith({ code: "backup", returnTo: "/settings" });
    expect(mocks.regenerate).toHaveBeenCalledWith({ password: "password", confirmed: true });
  });
});
