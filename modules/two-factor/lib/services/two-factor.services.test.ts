import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  findUser: vi.fn(),
  findSessions: vi.fn(),
  deleteSessions: vi.fn(),
  deleteTwoFactor: vi.fn(),
  enableTwoFactor: vi.fn(),
  verifyTOTP: vi.fn(),
  verifyBackupCode: vi.fn(),
  generateBackupCodes: vi.fn(),
  writeAuthAudit: vi.fn(),
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("better-auth/api", () => ({
  isAPIError: (error: unknown) => Boolean((error as { api?: boolean } | null)?.api),
}));
vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      enableTwoFactor: mocks.enableTwoFactor,
      verifyTOTP: mocks.verifyTOTP,
      verifyBackupCode: mocks.verifyBackupCode,
      generateBackupCodes: mocks.generateBackupCodes,
    },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/lib/auth/audit", () => ({ writeAuthAudit: mocks.writeAuthAudit }));
vi.mock("@/lib/auth/credential-mutation-lock", () => ({
  tryAcquireCredentialMutationLock: mocks.acquireLock,
}));
vi.mock("@/lib/persistence/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUser },
    session: {
      findMany: mocks.findSessions,
      deleteMany: mocks.deleteSessions,
    },
    twoFactor: { deleteMany: mocks.deleteTwoFactor },
  },
}));

import {
  beginTwoFactorEnrollment,
  getTwoFactorStatus,
  regenerateTwoFactorBackupCodes,
  verifyTwoFactorBackupChallenge,
  verifyTwoFactorEnrollment,
  verifyTwoFactorTotpChallenge,
} from "./two-factor.services";

const session = {
  session: {
    id: "session-current",
    token: "token-current",
    createdAt: new Date(),
  },
  user: {
    id: "admin-current",
    role: "platform_admin",
    adminProfile: "operator",
    status: "active",
    temporaryPasswordChangeRequired: false,
    twoFactorEnabled: false,
    twoFactorVerified: false,
  },
};

function adminState(enabled = false, verified = false) {
  return {
    id: "admin-current",
    role: "platform_admin",
    adminProfile: "operator",
    status: "active",
    temporaryPasswordChangeRequired: false,
    twoFactorEnabled: enabled,
    twoFactor: { id: "factor-current", verified, lockedUntil: null },
    accounts: [{ id: "credential-current" }],
    workspace: { lifecycle: "ACTIVE" },
  };
}

function apiError(code: string) {
  return { api: true, body: { code } };
}

describe("administrator two-factor services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue(session);
    mocks.findUser.mockResolvedValue(adminState());
    mocks.deleteSessions.mockResolvedValue({ count: 2 });
    mocks.deleteTwoFactor.mockResolvedValue({ count: 1 });
    mocks.findSessions.mockResolvedValue([{ id: "session-replacement" }]);
    mocks.writeAuthAudit.mockResolvedValue(undefined);
    mocks.releaseLock.mockResolvedValue(undefined);
    mocks.acquireLock.mockResolvedValue({ release: mocks.releaseLock });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("leaves trial users outside enrollment and exposes no account detail", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      ...session,
      user: { ...session.user, role: "trial_user", adminProfile: null },
    });

    await expect(getTwoFactorStatus()).resolves.toMatchObject({
      success: false,
      error: { code: "OPERATION_NOT_ALLOWED" },
    });
    await expect(beginTwoFactorEnrollment({ password: "not-logged" })).resolves.toMatchObject({
      success: false,
      error: { code: "OPERATION_NOT_ALLOWED" },
    });
    expect(mocks.enableTwoFactor).not.toHaveBeenCalled();
  });

  it("returns only the transient official enrollment material after password validation", async () => {
    mocks.enableTwoFactor.mockResolvedValue({
      method: "totp",
      totpURI: "otpauth://totp/App:admin?secret=MANUALSECRET&issuer=App",
      backupCodes: ["backup-one", "backup-two"],
    });

    const result = await beginTwoFactorEnrollment({ password: "current-password" });

    expect(result).toEqual({
      success: true,
      data: {
        totpURI: "otpauth://totp/App:admin?secret=MANUALSECRET&issuer=App",
        manualSecret: "MANUALSECRET",
        backupCodes: ["backup-one", "backup-two"],
      },
    });
    expect(mocks.enableTwoFactor).toHaveBeenCalledWith(expect.objectContaining({
      body: { password: "current-password", method: "totp" },
    }));
    expect(JSON.stringify(mocks.writeAuthAudit.mock.calls)).not.toContain("current-password");
    expect(JSON.stringify(mocks.writeAuthAudit.mock.calls)).not.toContain("MANUALSECRET");
    expect(JSON.stringify(mocks.writeAuthAudit.mock.calls)).not.toContain("backup-one");
  });

  it("maps an invalid enrollment password without logging it or creating a factor", async () => {
    mocks.enableTwoFactor.mockRejectedValue(apiError("INVALID_PASSWORD"));

    await expect(beginTwoFactorEnrollment({ password: "wrong-password" })).resolves.toMatchObject({
      success: false,
      error: { code: "INVALID_CURRENT_PASSWORD" },
    });
    expect(mocks.deleteTwoFactor).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.writeAuthAudit.mock.calls)).not.toContain("wrong-password");
  });

  it("keeps enrollment disabled after an invalid first TOTP", async () => {
    mocks.verifyTOTP.mockRejectedValue(apiError("INVALID_CODE"));

    await expect(verifyTwoFactorEnrollment({ code: "123456" })).resolves.toMatchObject({
      success: false,
      error: { code: "INVALID_TWO_FACTOR_CODE" },
    });
    expect(mocks.deleteSessions).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.writeAuthAudit.mock.calls)).not.toContain("123456");
  });

  it("completes enrollment only after both authoritative states agree and revokes other sessions", async () => {
    mocks.verifyTOTP.mockResolvedValue({ token: "old-token", user: { id: "admin-current" } });
    mocks.findUser
      .mockResolvedValueOnce(adminState(false, false))
      .mockResolvedValueOnce(adminState(true, true));

    await expect(verifyTwoFactorEnrollment({ code: "123456" })).resolves.toMatchObject({
      success: true,
      data: { revokedSessions: 2 },
    });
    expect(mocks.deleteSessions).toHaveBeenCalledWith({
      where: { userId: "admin-current", id: { not: "session-replacement" } },
    });
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "auth.mfa.enrollment_complete",
      outcome: "SUCCEEDED",
    }));
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "auth.login",
      outcome: "SUCCEEDED",
    }));
  });

  it("accepts the signed challenge only without an existing definitive session", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);
    mocks.verifyTOTP.mockResolvedValue({ token: "token-final", user: { id: "admin-current" } });
    mocks.findUser.mockResolvedValue(adminState(true, true));

    await expect(verifyTwoFactorTotpChallenge({ code: "123456", returnTo: "/users" }))
      .resolves.toEqual({ success: true, data: { returnTo: "/users" } });
    expect(mocks.verifyTOTP).toHaveBeenCalledWith(expect.objectContaining({
      body: { code: "123456", trustDevice: false },
    }));
    expect(JSON.stringify(mocks.writeAuthAudit.mock.calls)).not.toContain("123456");
  });

  it("uses backup codes through Better Auth and never enables a trusted device", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);
    mocks.verifyBackupCode.mockResolvedValue({
      token: "token-final",
      user: { id: "admin-current" },
    });
    mocks.findUser.mockResolvedValue(adminState(true, true));

    await expect(verifyTwoFactorBackupChallenge({ code: "backup-secret", returnTo: "/settings" }))
      .resolves.toEqual({ success: true, data: { returnTo: "/settings" } });
    expect(mocks.verifyBackupCode).toHaveBeenCalledWith(expect.objectContaining({
      body: { code: "backup-secret", trustDevice: false, disableSession: false },
    }));
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "auth.mfa.backup_code_used",
    }));
    expect(JSON.stringify(mocks.writeAuthAudit.mock.calls)).not.toContain("backup-secret");
  });

  it("returns a generic lockout and removes any post-verification session on failure", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);
    mocks.verifyTOTP.mockRejectedValue(apiError("ACCOUNT_TEMPORARILY_LOCKED"));

    await expect(verifyTwoFactorTotpChallenge({ code: "000000" })).resolves.toMatchObject({
      success: false,
      error: { code: "MFA_TEMPORARILY_LOCKED" },
    });
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "auth.mfa.challenge_locked",
      outcome: "DENIED",
    }));
  });

  it("allows recent owner or operator sessions to replace backup codes and revokes other sessions", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      ...session,
      user: { ...session.user, twoFactorEnabled: true, twoFactorVerified: true },
    });
    mocks.findUser.mockResolvedValue(adminState(true, true));
    mocks.generateBackupCodes.mockResolvedValue({ backupCodes: ["replacement-one"] });

    await expect(regenerateTwoFactorBackupCodes({
      password: "current-password",
      confirmed: true,
    })).resolves.toMatchObject({
      success: true,
      data: { backupCodes: ["replacement-one"], revokedSessions: 2 },
    });
    expect(mocks.generateBackupCodes).toHaveBeenCalledWith(expect.objectContaining({
      body: { password: "current-password" },
    }));
    expect(mocks.deleteSessions).toHaveBeenCalledWith({
      where: { userId: "admin-current", id: { not: "session-current" } },
    });
    expect(JSON.stringify(mocks.writeAuthAudit.mock.calls)).not.toContain("replacement-one");
  });
});
