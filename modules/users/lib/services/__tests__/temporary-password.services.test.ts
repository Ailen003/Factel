import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getCurrentSession: vi.fn(),
  changePassword: vi.fn(),
  transaction: vi.fn(),
  writeAuthAudit: vi.fn(),
  isAPIError: vi.fn(),
  tryAcquireCredentialMutationLock: vi.fn(),
  releaseCredentialMutationLock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("better-auth/api", () => ({ isAPIError: mocks.isAPIError }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/lib/auth/auth", () => ({ auth: { api: { changePassword: mocks.changePassword } } }));
vi.mock("@/lib/auth/audit", () => ({ writeAuthAudit: mocks.writeAuthAudit }));
vi.mock("@/lib/auth/credential-mutation-lock", () => ({
  tryAcquireCredentialMutationLock: mocks.tryAcquireCredentialMutationLock,
}));
vi.mock("@/lib/persistence/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import {
  changeTemporaryPassword,
  getTemporaryPasswordState,
} from "../temporary-password.services";

const requestHeaders = new Headers({ cookie: "session=opaque" });
const authenticatedSession = {
  session: { id: "session-current", userId: "trial-1", token: "opaque" },
  user: {
    id: "trial-1",
    status: "active",
    temporaryPasswordChangeRequired: true,
  },
};

function activationTransaction(current?: Partial<{
  status: "active" | "suspended";
  temporaryPasswordChangeRequired: boolean;
  temporaryPasswordExpiresAt: Date | null;
  temporaryPasswordPurpose: "activation" | "recovery" | null;
  trialActivatedAt: Date | null;
  trialExpiresAt: Date | null;
}>) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
    user: {
      findUnique: vi.fn().mockResolvedValue({
        status: "active",
        temporaryPasswordChangeRequired: true,
        temporaryPasswordExpiresAt: new Date("2026-09-12T00:00:00.000Z"),
        temporaryPasswordPurpose: "activation",
        trialActivatedAt: null,
        trialExpiresAt: null,
        ...current,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
  };
}

describe("temporary-password replacement service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T12:00:00.000Z"));
    mocks.headers.mockResolvedValue(requestHeaders);
    mocks.getCurrentSession.mockResolvedValue(authenticatedSession);
    mocks.changePassword.mockResolvedValue({ user: { id: "trial-1" }, token: null });
    mocks.writeAuthAudit.mockResolvedValue(undefined);
    mocks.isAPIError.mockReturnValue(false);
    mocks.releaseCredentialMutationLock.mockResolvedValue(undefined);
    mocks.tryAcquireCredentialMutationLock.mockImplementation(async () => ({
      release: mocks.releaseCredentialMutationLock,
    }));
  });

  it("exposes only recovery purpose and expiry in the minimal pending state", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      ...authenticatedSession,
      user: {
        ...authenticatedSession.user,
        temporaryPasswordPurpose: "recovery",
        temporaryPasswordExpiresAt: new Date("2026-09-12T00:00:00.000Z"),
        trialActivatedAt: new Date("2026-09-01T08:00:00.000Z"),
        trialExpiresAt: new Date("2026-09-15T08:00:00.000Z"),
      },
    });

    await expect(getTemporaryPasswordState()).resolves.toEqual({
      success: true,
      data: {
        status: "required",
        purpose: "recovery",
        expiresAt: "2026-09-12T00:00:00.000Z",
      },
    });
  });

  it("changes through Better Auth, activates once, starts 14 days, and revokes other sessions", async () => {
    const transaction = activationTransaction();
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));

    const result = await changeTemporaryPassword({
      currentPassword: "temporary-secret",
      newPassword: "new-private-secret",
    });

    expect(result).toEqual({
      success: true,
      data: {
        activatedAt: "2026-09-09T12:00:00.000Z",
        trialExpiresAt: "2026-09-23T12:00:00.000Z",
        revokedSessions: 2,
        replayed: false,
      },
    });
    expect(mocks.changePassword).toHaveBeenCalledWith({
      headers: requestHeaders,
      body: {
        currentPassword: "temporary-secret",
        newPassword: "new-private-secret",
        revokeOtherSessions: false,
      },
    });
    expect(transaction.user.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "trial-1", temporaryPasswordChangeRequired: true, trialActivatedAt: null }),
      data: expect.objectContaining({
        temporaryPasswordChangeRequired: false,
        temporaryPasswordExpiresAt: null,
        temporaryPasswordPurpose: null,
        trialActivatedAt: new Date("2026-09-09T12:00:00.000Z"),
        trialExpiresAt: new Date("2026-09-23T12:00:00.000Z"),
      }),
    });
    expect(transaction.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "trial-1", id: { not: "session-current" } },
    });
    const audited = JSON.stringify(mocks.writeAuthAudit.mock.calls.map(([input]) => input));
    expect(audited).not.toContain("temporary-secret");
    expect(audited).not.toContain("new-private-secret");
  });

  it("denies an expired credential before touching the password", async () => {
    const transaction = activationTransaction({
      temporaryPasswordExpiresAt: new Date("2026-09-09T11:59:59.999Z"),
    });
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));

    await expect(changeTemporaryPassword({
      currentPassword: "temporary-secret",
      newPassword: "new-private-secret",
    })).resolves.toMatchObject({
      success: false,
      error: { code: "TEMPORARY_PASSWORD_EXPIRED" },
    });
    expect(mocks.changePassword).not.toHaveBeenCalled();
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "DENIED",
      safeMetadata: { reason: "TEMPORARY_PASSWORD_EXPIRED" },
    }), transaction);
  });

  it("returns a safe error for an incorrect current password", async () => {
    const transaction = activationTransaction();
    const authError = { body: { code: "INVALID_PASSWORD" } };
    mocks.changePassword.mockRejectedValue(authError);
    mocks.isAPIError.mockImplementation((error) => error === authError);
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));

    await expect(changeTemporaryPassword({
      currentPassword: "wrong-password",
      newPassword: "new-private-secret",
    })).resolves.toMatchObject({
      success: false,
      error: { code: "INVALID_CURRENT_PASSWORD" },
    });
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "DENIED",
      safeMetadata: { reason: "INVALID_CURRENT_PASSWORD" },
    }));
  });

  it("fails closed before opening a transaction when another credential mutation holds the lock", async () => {
    mocks.tryAcquireCredentialMutationLock.mockResolvedValueOnce(null);

    await expect(changeTemporaryPassword({
      currentPassword: "temporary-secret",
      newPassword: "new-private-secret",
    })).resolves.toMatchObject({
      success: false,
      error: { code: "PASSWORD_REPLACEMENT_FAILED" },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it("serializes replay and never extends an existing activation", async () => {
    const first = activationTransaction();
    const second = activationTransaction({
      temporaryPasswordChangeRequired: false,
      temporaryPasswordExpiresAt: null,
      temporaryPasswordPurpose: null,
      trialActivatedAt: new Date("2026-09-09T12:00:00.000Z"),
      trialExpiresAt: new Date("2026-09-23T12:00:00.000Z"),
    });
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(first))
      .mockImplementationOnce(async (operation) => operation(second));

    const initial = await changeTemporaryPassword({ currentPassword: "temporary-secret", newPassword: "new-private-secret" });
    vi.setSystemTime(new Date("2026-09-10T12:00:00.000Z"));
    const replay = await changeTemporaryPassword({ currentPassword: "temporary-secret", newPassword: "another-secret" });

    expect(initial).toMatchObject({ success: true, data: { replayed: false } });
    expect(replay).toMatchObject({
      success: true,
      data: {
        replayed: true,
        activatedAt: "2026-09-09T12:00:00.000Z",
        trialExpiresAt: "2026-09-23T12:00:00.000Z",
      },
    });
    expect(mocks.changePassword).toHaveBeenCalledTimes(1);
    expect(first.user.updateMany).toHaveBeenCalledTimes(1);
    expect(second.user.updateMany).not.toHaveBeenCalled();
    expect(mocks.tryAcquireCredentialMutationLock).toHaveBeenCalledTimes(2);
    expect(mocks.releaseCredentialMutationLock).toHaveBeenCalledTimes(2);
  });

  it("completes a recovery credential without restarting or extending the trial", async () => {
    const transaction = activationTransaction({
      temporaryPasswordPurpose: "recovery",
      trialActivatedAt: new Date("2026-09-01T08:00:00.000Z"),
      trialExpiresAt: new Date("2026-09-15T08:00:00.000Z"),
    });
    transaction.user.findUnique.mockResolvedValue({
      status: "active",
      temporaryPasswordChangeRequired: true,
      temporaryPasswordExpiresAt: new Date("2026-09-12T00:00:00.000Z"),
      temporaryPasswordPurpose: "recovery",
      trialActivatedAt: new Date("2026-09-01T08:00:00.000Z"),
      trialExpiresAt: new Date("2026-09-15T08:00:00.000Z"),
    });
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));

    const result = await changeTemporaryPassword({
      currentPassword: "temporary-recovery-secret",
      newPassword: "new-private-secret",
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        activatedAt: "2026-09-01T08:00:00.000Z",
        trialExpiresAt: "2026-09-15T08:00:00.000Z",
        replayed: false,
      },
    });
    const update = transaction.user.updateMany.mock.calls[0][0];
    expect(update.data).toEqual({
      temporaryPasswordChangeRequired: false,
      temporaryPasswordExpiresAt: null,
      temporaryPasswordPurpose: null,
    });
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "user.password_recover",
      outcome: "SUCCEEDED",
      safeMetadata: expect.objectContaining({ purpose: "recovery" }),
    }), transaction);
  });

  it("reports the partial-failure recovery path when Better Auth changed the password but activation did not commit", async () => {
    const transaction = activationTransaction();
    transaction.user.updateMany.mockResolvedValue({ count: 0 });
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));

    const result = await changeTemporaryPassword({
      currentPassword: "temporary-secret",
      newPassword: "new-private-secret",
    });

    expect(mocks.changePassword).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: false, error: { code: "PASSWORD_REPLACEMENT_FAILED" } });
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "FAILED",
      safeMetadata: { reason: "PASSWORD_REPLACEMENT_FAILED" },
    }));
    const audited = JSON.stringify(mocks.writeAuthAudit.mock.calls);
    expect(audited).not.toContain("temporary-secret");
    expect(audited).not.toContain("new-private-secret");
  });

  it("blocks a suspended account before opening an activation transaction", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      ...authenticatedSession,
      user: { ...authenticatedSession.user, status: "suspended" },
    });
    await expect(changeTemporaryPassword({
      currentPassword: "temporary-secret",
      newPassword: "new-private-secret",
    })).resolves.toMatchObject({ success: false, error: { code: "ACCOUNT_INACTIVE" } });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.tryAcquireCredentialMutationLock).not.toHaveBeenCalled();
  });

  it("holds the shared session lock until a delayed Better Auth password change finishes", async () => {
    const transaction = activationTransaction();
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));

    let held = false;
    const release = vi.fn(async () => {
      held = false;
    });
    mocks.tryAcquireCredentialMutationLock.mockImplementationOnce(async () => {
      held = true;
      return { release };
    });
    let finishPasswordWrite!: () => void;
    mocks.changePassword.mockImplementationOnce(
      () => new Promise((resolve) => {
        finishPasswordWrite = () => resolve({ user: { id: "trial-1" }, token: null });
      }),
    );

    const pending = changeTemporaryPassword({
      currentPassword: "temporary-secret",
      newPassword: "new-private-secret",
    });
    await vi.waitFor(() => expect(mocks.changePassword).toHaveBeenCalledTimes(1));
    expect(held).toBe(true);
    expect(release).not.toHaveBeenCalled();

    finishPasswordWrite();
    await expect(pending).resolves.toMatchObject({ success: true });
    expect(release).toHaveBeenCalledTimes(1);
    expect(held).toBe(false);
  });
});
