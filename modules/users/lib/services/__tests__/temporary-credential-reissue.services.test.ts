import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireAdminCapability: vi.fn(),
  generateTemporaryPassword: vi.fn(),
  hashPassword: vi.fn(),
  transaction: vi.fn(),
  writeAuthAudit: vi.fn(),
  tryAcquireCredentialMutationLock: vi.fn(),
  releaseCredentialMutationLock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/auth/admin-authorization", () => ({
  requireAdminCapability: mocks.requireAdminCapability,
}));
vi.mock("@/lib/auth/temporary-credential", () => ({
  generateTemporaryPassword: mocks.generateTemporaryPassword,
}));
vi.mock("better-auth/crypto", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("@/lib/auth/audit", () => ({ writeAuthAudit: mocks.writeAuthAudit }));
vi.mock("@/lib/auth/credential-mutation-lock", () => ({
  tryAcquireCredentialMutationLock: mocks.tryAcquireCredentialMutationLock,
}));
vi.mock("@/lib/persistence/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

import {
  confirmTemporaryCredentialDelivery,
  reissueTemporaryCredential,
} from "../temporary-credential-reissue.services";

const requestHeaders = new Headers({ cookie: "opaque-admin-session" });
const operationId = "3f44d98d-d250-47d1-aa24-1e7221616e61";
const temporaryPassword = "server-generated-temporary-secret";

type TargetFixture = {
  id: string;
  role: string;
  status: string;
  trialActivatedAt: Date | null;
  trialExpiresAt: Date | null;
  temporaryCredentialVersion: number;
};

const activationTarget: TargetFixture = {
  id: "trial-1",
  role: "trial_user",
  status: "active",
  trialActivatedAt: null,
  trialExpiresAt: null,
  temporaryCredentialVersion: 0,
};

function preparationTransaction(
  target: TargetFixture | null = activationTarget,
  options: {
    duplicate?: boolean;
    current?: "prepared" | "issued" | null;
    currentPreparedAt?: Date;
  } = {},
) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    temporaryCredentialIssuance: {
      findUnique: vi.fn().mockResolvedValue(options.duplicate ? { id: "existing" } : null),
      findFirst: vi.fn().mockResolvedValue(
        options.current
          ? {
              id: "previous",
              status: options.current,
              preparedAt:
                options.currentPreparedAt ?? new Date("2026-09-10T11:59:00.000Z"),
            }
          : null,
      ),
      update: vi.fn().mockResolvedValue({ id: "previous" }),
      create: vi.fn().mockResolvedValue({ id: "issuance-created" }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(target),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
  };
}

function finalTransaction(
  target: TargetFixture = { ...activationTarget, temporaryCredentialVersion: 1 },
  options: { version?: number; operationId?: string; reason?: string } = {},
) {
  const prepared = {
    id: expect.any(String),
    operationId: options.operationId ?? operationId,
    targetUserId: "trial-1",
    initiatedByUserId: "admin-1",
    deliveredByUserId: null,
    version: options.version ?? 1,
    purpose: target.trialActivatedAt ? "recovery" : "activation",
    reason: options.reason ?? "expired_credential",
    reasonNote: null,
    status: "prepared",
    preparedAt: new Date("2026-09-10T12:00:00.000Z"),
    issuedAt: null,
    expiresAt: null,
    failedAt: null,
    supersededAt: null,
    safeFailureCode: null,
    deliveryChannel: null,
    deliveredAt: null,
    supersededById: null,
  };
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    temporaryCredentialIssuance: {
      findUnique: vi.fn().mockResolvedValue(prepared),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(target),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    account: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  transaction.temporaryCredentialIssuance.update.mockImplementation(({ data }) => ({
    ...prepared,
    ...data,
    id: "issuance-1",
  }));
  return transaction;
}

function failedTransaction() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    temporaryCredentialIssuance: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

function request(overrides = {}) {
  return {
    targetUserId: "trial-1",
    operationId,
    expectedVersion: 0,
    reason: "expired_credential" as const,
    confirmed: true as const,
    ...overrides,
  };
}

describe("temporary credential reissue service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T12:00:00.000Z"));
    mocks.headers.mockResolvedValue(requestHeaders);
    mocks.requireAdminCapability.mockResolvedValue({
      user: { id: "admin-1", adminProfile: "operator" },
    });
    mocks.generateTemporaryPassword.mockReturnValue(temporaryPassword);
    mocks.hashPassword.mockResolvedValue("better-auth-password-hash");
    mocks.writeAuthAudit.mockResolvedValue(undefined);
    mocks.releaseCredentialMutationLock.mockResolvedValue(undefined);
    mocks.tryAcquireCredentialMutationLock.mockImplementation(async () => ({
      release: mocks.releaseCredentialMutationLock,
    }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("reissues an expired activation credential for exactly 72 hours", async () => {
    const preparation = preparationTransaction();
    const finalization = finalTransaction();
    let mutationLockHeld = false;
    mocks.tryAcquireCredentialMutationLock.mockImplementationOnce(async () => {
      mutationLockHeld = true;
      return {
        release: async () => {
          mutationLockHeld = false;
        },
      };
    });
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(preparation))
      .mockImplementationOnce(async (operation) => operation(finalization));
    mocks.hashPassword.mockImplementationOnce(async () => {
      expect(mutationLockHeld).toBe(true);
      return "better-auth-password-hash";
    });

    const result = await reissueTemporaryCredential(request());

    expect(mocks.requireAdminCapability).toHaveBeenCalledWith(
      "trial.credentials.reissue",
      requestHeaders,
    );
    expect(result).toMatchObject({
      success: true,
      data: {
        temporaryPassword,
        revokedSessions: 3,
        suspended: false,
        issuance: {
          purpose: "activation",
          issuedAt: "2026-09-10T12:00:00.000Z",
          expiresAt: "2026-09-13T12:00:00.000Z",
        },
      },
    });
    expect(mocks.hashPassword).toHaveBeenCalledWith(temporaryPassword);
    expect(finalization.account.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "trial-1",
        providerId: "credential",
        password: { not: null },
      },
      data: { password: "better-auth-password-hash" },
    });
    expect(finalization.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "trial-1" },
    });
    expect(mutationLockHeld).toBe(false);
    expect(preparation.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        temporaryPasswordChangeRequired: true,
        temporaryPasswordPurpose: "activation",
        temporaryPasswordExpiresAt: new Date("2026-09-10T11:59:59.999Z"),
      }),
    }));
  });

  it("preserves recovery dates and suspended status exactly", async () => {
    const recoveryTarget = {
      ...activationTarget,
      status: "suspended",
      trialActivatedAt: new Date("2026-09-01T08:00:00.000Z"),
      trialExpiresAt: new Date("2026-09-15T08:00:00.000Z"),
    } as const;
    const preparation = preparationTransaction(recoveryTarget);
    const finalization = finalTransaction({
      ...recoveryTarget,
      temporaryCredentialVersion: 1,
    });
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(preparation))
      .mockImplementationOnce(async (operation) => operation(finalization));

    const result = await reissueTemporaryCredential(request({
      reason: "forgotten_password",
    }));

    expect(result).toMatchObject({
      success: true,
      data: { suspended: true, issuance: { purpose: "recovery" } },
    });
    for (const update of [
      preparation.user.updateMany.mock.calls[0][0],
      finalization.user.updateMany.mock.calls[0][0],
    ]) {
      expect(update.where).toMatchObject({
        status: "suspended",
        trialActivatedAt: recoveryTarget.trialActivatedAt,
        trialExpiresAt: recoveryTarget.trialExpiresAt,
      });
      expect(update.data).not.toHaveProperty("status");
      expect(update.data).not.toHaveProperty("trialActivatedAt");
      expect(update.data).not.toHaveProperty("trialExpiresAt");
      expect(update.data).not.toHaveProperty("initialCreditAllocation");
      expect(update.data).not.toHaveProperty("workspace");
      expect(update.data).not.toHaveProperty("creditEntries");
    }
  });

  it("rejects non-administrators before persistence or password hashing", async () => {
    mocks.requireAdminCapability.mockRejectedValue(new AuthError("FORBIDDEN"));
    await expect(reissueTemporaryCredential(request())).resolves.toMatchObject({
      success: false,
      error: { code: "FORBIDDEN" },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.tryAcquireCredentialMutationLock).not.toHaveBeenCalled();
    expect(mocks.hashPassword).not.toHaveBeenCalled();
  });

  it.each([
    [null, "USER_NOT_FOUND"],
    [
      { ...activationTarget, role: "platform_admin", adminProfile: "operator" },
      "ADMIN_TARGET_FORBIDDEN",
    ],
    [{ ...activationTarget, status: "deleted" }, "INVALID_CREDENTIAL_TARGET"],
  ])("rejects an invalid target", async (target, code) => {
    const transaction = preparationTransaction(target as never);
    mocks.transaction.mockImplementationOnce(async (operation) => operation(transaction));
    await expect(reissueTemporaryCredential(request())).resolves.toMatchObject({
      success: false,
      error: { code },
    });
    expect(mocks.hashPassword).not.toHaveBeenCalled();
  });

  it("rejects duplicate operations and stale versions without generating a secret", async () => {
    const duplicate = preparationTransaction(activationTarget, { duplicate: true });
    const stale = preparationTransaction({
      ...activationTarget,
      temporaryCredentialVersion: 2,
    });
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(duplicate))
      .mockImplementationOnce(async (operation) => operation(stale));

    await expect(reissueTemporaryCredential(request())).resolves.toMatchObject({
      success: false,
      error: { code: "DUPLICATE_OPERATION" },
    });
    await expect(reissueTemporaryCredential(request({
      operationId: "00539cc8-07ea-4c97-83df-b8d9c770b24e",
    }))).resolves.toMatchObject({
      success: false,
      error: { code: "STALE_CREDENTIAL_VERSION" },
    });
    expect(mocks.generateTemporaryPassword).not.toHaveBeenCalled();
  });

  it("maps a concurrent database uniqueness race to an explicit conflict", async () => {
    mocks.transaction.mockRejectedValueOnce(
      Object.assign(new Error("unique constraint"), { code: "P2002" }),
    );

    await expect(reissueTemporaryCredential(request())).resolves.toMatchObject({
      success: false,
      error: { code: "CREDENTIAL_CONFLICT" },
    });
    expect(mocks.generateTemporaryPassword).not.toHaveBeenCalled();
    expect(mocks.hashPassword).not.toHaveBeenCalled();
  });

  it("fails closed when Better Auth cannot hash the password", async () => {
    const preparation = preparationTransaction();
    const finalization = finalTransaction();
    const failed = failedTransaction();
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(preparation))
      .mockImplementationOnce(async (operation) => operation(finalization))
      .mockImplementationOnce(async (operation) => operation(failed));
    mocks.hashPassword.mockRejectedValue(new Error("provider unavailable"));

    const result = await reissueTemporaryCredential(request());

    expect(result).toMatchObject({
      success: false,
      error: { code: "CREDENTIAL_REISSUE_FAILED" },
    });
    expect(JSON.stringify(result)).not.toContain(temporaryPassword);
    expect(failed.temporaryCredentialIssuance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
    expect(preparation.user.updateMany).toHaveBeenCalled();
  });

  it("does not return the secret when a post-rotation step fails", async () => {
    const preparation = preparationTransaction();
    const finalization = finalTransaction();
    const failed = failedTransaction();
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(preparation))
      .mockImplementationOnce(async (operation) => operation(finalization))
      .mockImplementationOnce(async (operation) => operation(failed));
    finalization.session.deleteMany.mockRejectedValue(
      new Error("session boundary failed"),
    );

    const result = await reissueTemporaryCredential(request());

    expect(mocks.hashPassword).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: false,
      error: { code: "CREDENTIAL_REISSUE_FAILED" },
    });
    expect(JSON.stringify(result)).not.toContain(temporaryPassword);
  });

  it("does not declare success when the mandatory issuance audit fails", async () => {
    const preparation = preparationTransaction();
    const finalization = finalTransaction();
    const failed = failedTransaction();
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(preparation))
      .mockImplementationOnce(async (operation) => operation(finalization))
      .mockImplementationOnce(async (operation) => operation(failed));
    mocks.writeAuthAudit
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("audit unavailable"))
      .mockResolvedValueOnce(undefined);

    const result = await reissueTemporaryCredential(request());

    expect(mocks.hashPassword).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: false,
      error: { code: "CREDENTIAL_REISSUE_FAILED" },
    });
    expect(JSON.stringify(result)).not.toContain(temporaryPassword);
    expect(failed.temporaryCredentialIssuance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          safeFailureCode: "CREDENTIAL_REISSUE_FAILED",
        }),
      }),
    );
  });

  it("supersedes a prior issued credential in the audited preparation", async () => {
    const preparation = preparationTransaction(activationTarget, { current: "issued" });
    const finalization = finalTransaction();
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(preparation))
      .mockImplementationOnce(async (operation) => operation(finalization));

    await expect(reissueTemporaryCredential(request())).resolves.toMatchObject({
      success: true,
    });
    expect(preparation.temporaryCredentialIssuance.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "previous" },
        data: expect.objectContaining({ status: "superseded" }),
      }),
    );
    expect(preparation.temporaryCredentialIssuance.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ supersededById: expect.any(String) }) }),
    );
  });

  it("allows only an explicit failure recovery to replace an abandoned preparation", async () => {
    const abandoned = preparationTransaction(
      { ...activationTarget, temporaryCredentialVersion: 1 },
      { current: "prepared" },
    );
    const recoverable = preparationTransaction(
      { ...activationTarget, temporaryCredentialVersion: 1 },
      { current: "prepared" },
    );
    const takeoverOperationId = "5ebc40f8-8f75-4b39-866c-0734030ce0f9";
    const finalization = finalTransaction(
      { ...activationTarget, temporaryCredentialVersion: 2 },
      { version: 2, operationId: takeoverOperationId, reason: "failure_recovery" },
    );
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(abandoned))
      .mockImplementationOnce(async (operation) => operation(recoverable))
      .mockImplementationOnce(async (operation) => operation(finalization));

    await expect(reissueTemporaryCredential(request({
      operationId: "a557cefa-06aa-4afc-892a-f69e02264a8b",
      expectedVersion: 1,
      reason: "forgotten_password",
    }))).resolves.toMatchObject({
      success: false,
      error: { code: "CREDENTIAL_ISSUANCE_IN_PROGRESS" },
    });
    await expect(reissueTemporaryCredential(request({
      operationId: takeoverOperationId,
      expectedVersion: 1,
      reason: "failure_recovery",
    }))).resolves.toMatchObject({ success: true });
    expect(recoverable.temporaryCredentialIssuance.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "superseded" }) }),
    );
  });

  it("rejects a concurrent administrator while a delayed provider write holds the session lock", async () => {
    const preparation = preparationTransaction();
    const finalization = finalTransaction();
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(preparation))
      .mockImplementationOnce(async (operation) => operation(finalization));

    let held = false;
    const release = vi.fn(async () => {
      held = false;
    });
    mocks.tryAcquireCredentialMutationLock.mockImplementation(async () => {
      if (held) return null;
      held = true;
      return { release };
    });

    let finishPasswordWrite!: () => void;
    mocks.hashPassword.mockImplementationOnce(
      () => new Promise((resolve) => {
        finishPasswordWrite = () => resolve("better-auth-password-hash");
      }),
    );

    const first = reissueTemporaryCredential(request());
    await vi.waitFor(() => expect(mocks.hashPassword).toHaveBeenCalledTimes(1));

    await expect(reissueTemporaryCredential(request({
      operationId: "78b8af7f-baf9-40df-ad71-d35c95b31461",
      reason: "failure_recovery",
    }))).resolves.toMatchObject({
      success: false,
      error: { code: "CREDENTIAL_CONFLICT" },
    });
    expect(release).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledTimes(2);

    finishPasswordWrite();
    await expect(first).resolves.toMatchObject({ success: true });
    expect(release).toHaveBeenCalledTimes(1);
    expect(held).toBe(false);
  });

  it("never includes the temporary secret in audit metadata, logs, or errors", async () => {
    const preparation = preparationTransaction();
    const finalization = finalTransaction();
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(preparation))
      .mockImplementationOnce(async (operation) => operation(finalization));
    const response = await reissueTemporaryCredential(request());
    const audits = JSON.stringify(mocks.writeAuthAudit.mock.calls);
    const logs = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(audits).not.toContain(temporaryPassword);
    expect(logs).not.toContain(temporaryPassword);
    expect(JSON.stringify(response)).toContain(temporaryPassword);

    mocks.transaction.mockReset();
    mocks.transaction
      .mockImplementationOnce(async (operation) =>
        operation(preparationTransaction()),
      )
      .mockImplementationOnce(async (operation) => operation(finalTransaction()))
      .mockImplementationOnce(async (operation) => operation(failedTransaction()));
    mocks.hashPassword.mockRejectedValueOnce(new Error(temporaryPassword));
    const failed = await reissueTemporaryCredential(request({
      operationId: "92dd62fb-9551-49f7-bc3f-c1b70ff30cf2",
    }));
    expect(JSON.stringify(failed)).not.toContain(temporaryPassword);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      temporaryPassword,
    );
  });
});

describe("temporary credential delivery service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T13:00:00.000Z"));
    mocks.headers.mockResolvedValue(requestHeaders);
    mocks.requireAdminCapability.mockResolvedValue({
      user: { id: "admin-2", adminProfile: "operator" },
    });
    mocks.writeAuthAudit.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  function deliveryTransaction(input: {
    deliveredAt?: Date | null;
    channel?: "phone" | "secure_message" | null;
    status?: "issued" | "superseded";
    version?: number;
  } = {}) {
    const issuance = {
      id: "issuance-1",
      operationId,
      targetUserId: "trial-1",
      initiatedByUserId: "admin-1",
      deliveredByUserId: input.deliveredAt ? "admin-2" : null,
      version: input.version ?? 1,
      purpose: "recovery",
      reason: "forgotten_password",
      reasonNote: null,
      status: input.status ?? "issued",
      preparedAt: new Date("2026-09-10T12:00:00.000Z"),
      issuedAt: new Date("2026-09-10T12:00:01.000Z"),
      expiresAt: new Date("2026-09-13T12:00:01.000Z"),
      failedAt: null,
      supersededAt: null,
      safeFailureCode: null,
      deliveryChannel: input.channel ?? null,
      deliveredAt: input.deliveredAt ?? null,
      supersededById: null,
      target: {
        role: "trial_user",
        status: "active",
        temporaryCredentialVersion: input.version ?? 1,
      },
    };
    return {
      $queryRaw: vi.fn().mockResolvedValue([]),
      temporaryCredentialIssuance: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ targetUserId: "trial-1" })
          .mockResolvedValueOnce(issuance),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
  }

  const delivery = {
    issuanceId: "issuance-1",
    expectedVersion: 1,
    channel: "secure_message" as const,
    confirmed: true as const,
  };

  it("confirms delivery once without storing or auditing a secret", async () => {
    const transaction = deliveryTransaction();
    mocks.transaction.mockImplementationOnce(async (operation) => operation(transaction));

    const result = await confirmTemporaryCredentialDelivery(delivery);

    expect(mocks.requireAdminCapability).toHaveBeenCalledWith(
      "trial.credentials.confirm_delivery",
      requestHeaders,
    );
    expect(result).toMatchObject({
      success: true,
      data: {
        replayed: false,
        issuance: {
          deliveredAt: "2026-09-10T13:00:00.000Z",
          deliveryChannel: "secure_message",
        },
      },
    });
    expect(transaction.temporaryCredentialIssuance.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ deliveredAt: null, deliveryChannel: null }),
      data: {
        deliveredAt: new Date("2026-09-10T13:00:00.000Z"),
        deliveryChannel: "secure_message",
        deliveredByUserId: "admin-2",
      },
    });
    const advisoryQuery = transaction.$queryRaw.mock.calls[0]?.[0] as {
      strings?: readonly string[];
    };
    expect(advisoryQuery.strings?.join("")).toContain("::text AS lock_status");
    expect(JSON.stringify(mocks.writeAuthAudit.mock.calls)).not.toContain("secret");
  });

  it("logs only the safe Prisma error code when confirmation fails", async () => {
    mocks.transaction.mockRejectedValueOnce(
      Object.assign(new Error("raw query details"), { code: "P2010" }),
    );

    await expect(confirmTemporaryCredentialDelivery(delivery)).resolves.toMatchObject({
      success: false,
      error: { code: "DELIVERY_CONFIRMATION_FAILED" },
    });
    expect(console.error).toHaveBeenCalledWith(
      "Temporary-credential administration failed",
      { operation: "confirm-delivery", errorName: "Error", errorCode: "P2010" },
    );
  });

  it("is idempotent for the same channel and conflicts for a changed channel", async () => {
    const deliveredAt = new Date("2026-09-10T12:30:00.000Z");
    const replay = deliveryTransaction({ deliveredAt, channel: "secure_message" });
    const conflict = deliveryTransaction({ deliveredAt, channel: "phone" });
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(replay))
      .mockImplementationOnce(async (operation) => operation(conflict));

    await expect(confirmTemporaryCredentialDelivery(delivery)).resolves.toMatchObject({
      success: true,
      data: { replayed: true },
    });
    await expect(confirmTemporaryCredentialDelivery(delivery)).resolves.toMatchObject({
      success: false,
      error: { code: "DELIVERY_CONFLICT" },
    });
    expect(mocks.writeAuthAudit).not.toHaveBeenCalled();
  });

  it("rejects a superseded or stale issuance", async () => {
    const superseded = deliveryTransaction({ status: "superseded" });
    const stale = deliveryTransaction({ version: 2 });
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(superseded))
      .mockImplementationOnce(async (operation) => operation(stale));

    await expect(confirmTemporaryCredentialDelivery(delivery)).resolves.toMatchObject({
      success: false,
      error: { code: "CREDENTIAL_SUPERSEDED" },
    });
    await expect(confirmTemporaryCredentialDelivery(delivery)).resolves.toMatchObject({
      success: false,
      error: { code: "STALE_CREDENTIAL_VERSION" },
    });
  });
});
