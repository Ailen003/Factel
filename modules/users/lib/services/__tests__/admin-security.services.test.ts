import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({
  verifyAdminStepUp: vi.fn(),
  requireAdminCapability: vi.fn(),
  requireActiveSession: vi.fn(),
  writeAuthAudit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/admin-step-up", () => ({ verifyAdminStepUp: mocks.verifyAdminStepUp }));
vi.mock("@/lib/auth/admin-authorization", () => ({ requireAdminCapability: mocks.requireAdminCapability }));
vi.mock("@/lib/auth/session", () => ({ requireActiveSession: mocks.requireActiveSession }));
vi.mock("@/lib/auth/audit", () => ({ writeAuthAudit: mocks.writeAuthAudit }));
vi.mock("@/lib/persistence/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import {
  acceptOwnershipTransfer,
  cancelOwnershipTransfer,
  declineOwnershipTransfer,
  getCurrentOwnershipTransfer,
  initiateOwnershipTransfer,
  recoverOperatorMfa,
} from "../admin-security.services";
import { AuthError } from "@/lib/auth/types";

const ownerId = "owner-1";
const operatorId = "operator-1";
const headers = new Headers();
const ownerSession = { session: { id: "owner-session" }, user: { id: ownerId } };
const stepUp = {
  operationId: "c675eab5-ef07-40df-bc50-74c9b4dd5e98",
  password: "never-audited-password",
  totpCode: "123456",
  confirmed: true as const,
};

const readyOwner = {
  id: ownerId,
  role: "platform_admin",
  adminProfile: "owner",
  adminProfileVersion: 3,
  status: "active",
  temporaryPasswordChangeRequired: false,
  twoFactorEnabled: true,
  twoFactor: { verified: true },
  accounts: [{ id: "credential-owner" }],
  workspace: { id: "workspace-owner", lifecycle: "ACTIVE" },
};

const readyOperator = {
  ...readyOwner,
  id: operatorId,
  adminProfile: "operator",
  adminProfileVersion: 7,
  accounts: [{ id: "credential-operator" }],
};

function pendingTransfer(overrides: Record<string, unknown> = {}) {
  return {
    id: "transfer-1",
    initiatedOperationId: "3f44d98d-d250-47d1-aa24-1e7221616e61",
    ownerUserId: ownerId,
    targetUserId: operatorId,
    ownerVersion: 3,
    targetVersion: 7,
    status: "pending",
    pendingKey: "ownership",
    expiresAt: new Date(Date.now() + 60_000),
    initiatedAt: new Date(),
    resolvedAt: null,
    owner: { name: "Current owner" },
    target: { name: "Target operator" },
    ...overrides,
  };
}

function transactionClient() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(2),
    adminSecurityOperation: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "security-operation" }),
    },
    ownershipTransfer: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === ownerId ? readyOwner : readyOperator)),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(1),
    },
    twoFactor: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    session: {
      findUnique: vi.fn().mockResolvedValue({ userId: ownerId }),
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    adminProfileMutation: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
  };
}

describe("administrative security services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyAdminStepUp.mockResolvedValue({ success: true, session: ownerSession, requestHeaders: headers });
    mocks.requireAdminCapability.mockResolvedValue(ownerSession);
    mocks.requireActiveSession.mockResolvedValue(ownerSession);
    mocks.writeAuthAudit.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("requires fresh password and TOTP step-up before touching recovery state", async () => {
    const transaction = transactionClient();
    mocks.transaction.mockImplementation(async (work) => work(transaction));
    mocks.verifyAdminStepUp.mockResolvedValue({
      success: false,
      code: "INVALID_TWO_FACTOR_CODE",
      actorUserId: ownerId,
    });
    const result = await recoverOperatorMfa({
      ...stepUp,
      targetUserId: operatorId,
      expectedAdminProfileVersion: 7,
      reason: "lost_all_factors",
    });
    expect(result).toMatchObject({ success: false, error: { code: "INVALID_TWO_FACTOR_CODE" } });
    expect(transaction.adminSecurityOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "operator_mfa_recovery",
        status: "denied",
        safeFailureCode: "INVALID_TWO_FACTOR_CODE",
      }),
    });
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "auth.mfa.operator_recovery_denied",
      outcome: "DENIED",
    }), transaction);
    expect(transaction.user.updateMany).not.toHaveBeenCalled();

    const recorded = transaction.adminSecurityOperation.create.mock.calls[0][0].data;
    transaction.adminSecurityOperation.findUnique.mockResolvedValue({
      kind: recorded.kind,
      parameterFingerprint: recorded.parameterFingerprint,
    });
    await recoverOperatorMfa({
      ...stepUp,
      targetUserId: operatorId,
      expectedAdminProfileVersion: 7,
      reason: "lost_all_factors",
    });
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      safeMetadata: expect.objectContaining({ repeatedAttempt: true }),
    }), transaction);
    await expect(recoverOperatorMfa({
      ...stepUp,
      targetUserId: operatorId,
      expectedAdminProfileVersion: 7,
      reason: "lost_device",
    })).resolves.toMatchObject({
      success: false,
      error: { code: "DUPLICATE_OPERATION" },
    });
    expect(transaction.adminSecurityOperation.create).toHaveBeenCalledTimes(1);
  });

  it("atomically removes the verified factor, disables MFA, revokes sessions and preserves suspension", async () => {
    const transaction = transactionClient();
    transaction.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === ownerId ? readyOwner : { ...readyOperator, status: "suspended" }));
    mocks.transaction.mockImplementation(async (work) => work(transaction));
    const result = await recoverOperatorMfa({
      ...stepUp,
      targetUserId: operatorId,
      expectedAdminProfileVersion: 7,
      reason: "lost_all_factors",
      operationalReference: "SEC-42",
    });
    expect(result).toMatchObject({
      success: true,
      data: { adminProfileVersion: 8, revokedSessions: 2, replayed: false },
    });
    expect(mocks.requireAdminCapability).toHaveBeenCalledWith("admin.mfa.operator.recover", headers);
    expect(transaction.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "suspended", adminProfileVersion: 7 }),
      data: { twoFactorEnabled: false, adminProfileVersion: 8 },
    }));
    expect(transaction.twoFactor.deleteMany).toHaveBeenCalledWith({ where: { userId: operatorId, verified: true } });
    expect(transaction.session.deleteMany).toHaveBeenCalledWith({ where: { userId: operatorId } });
    expect(transaction.adminSecurityOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "operator_mfa_recovery",
        status: "succeeded",
        committedTargetVersion: 8,
      }),
    });
    expect(JSON.stringify(mocks.writeAuthAudit.mock.calls)).not.toContain(stepUp.password);
    expect(JSON.stringify(mocks.writeAuthAudit.mock.calls)).not.toContain(stepUp.totpCode);
  });

  it("rejects self-recovery and inconsistent factor state without mutation", async () => {
    const selfTransaction = transactionClient();
    mocks.transaction.mockImplementationOnce(async (work) => work(selfTransaction));
    await expect(recoverOperatorMfa({
      ...stepUp,
      targetUserId: ownerId,
      expectedAdminProfileVersion: 3,
      reason: "lost_device",
    })).resolves.toMatchObject({ success: false, error: { code: "SELF_RECOVERY_FORBIDDEN" } });

    const inconsistentTransaction = transactionClient();
    inconsistentTransaction.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === ownerId ? readyOwner : { ...readyOperator, twoFactorEnabled: false }));
    mocks.transaction.mockImplementationOnce(async (work) => work(inconsistentTransaction));
    await expect(recoverOperatorMfa({
      ...stepUp,
      operationId: "3f44d98d-d250-47d1-aa24-1e7221616e61",
      targetUserId: operatorId,
      expectedAdminProfileVersion: 7,
      reason: "lost_device",
    })).resolves.toMatchObject({ success: false, error: { code: "INVALID_MFA_RECOVERY_TARGET" } });
    expect(selfTransaction.user.updateMany).not.toHaveBeenCalled();
    expect(inconsistentTransaction.user.updateMany).not.toHaveBeenCalled();
  });

  it("denies an operator actor before opening a recovery transaction", async () => {
    const transaction = transactionClient();
    mocks.transaction.mockImplementation(async (work) => work(transaction));
    mocks.requireAdminCapability.mockRejectedValue(new AuthError("FORBIDDEN"));
    await expect(recoverOperatorMfa({
      ...stepUp,
      targetUserId: operatorId,
      expectedAdminProfileVersion: 7,
      reason: "lost_device",
    })).resolves.toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
    expect(transaction.adminSecurityOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "denied", safeFailureCode: "FORBIDDEN" }),
    });
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["an owner", { ...readyOperator, adminProfile: "owner" }],
    ["a trial user", { ...readyOperator, role: "trial_user", adminProfile: null }],
    ["a credential-inconsistent operator", { ...readyOperator, accounts: [] }],
  ])("rejects %s as an MFA recovery target", async (_label, invalidTarget) => {
    const transaction = transactionClient();
    transaction.user.findUnique
      .mockResolvedValueOnce(readyOwner)
      .mockResolvedValueOnce(invalidTarget as typeof readyOperator);
    mocks.transaction.mockImplementation(async (work) => work(transaction));
    await expect(recoverOperatorMfa({
      ...stepUp,
      targetUserId: operatorId,
      expectedAdminProfileVersion: 7,
      reason: "lost_device",
    })).resolves.toMatchObject({
      success: false,
      error: { code: "INVALID_MFA_RECOVERY_TARGET" },
    });
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a stale operator version without removing the factor or sessions", async () => {
    const transaction = transactionClient();
    mocks.transaction.mockImplementation(async (work) => work(transaction));
    await expect(recoverOperatorMfa({
      ...stepUp,
      targetUserId: operatorId,
      expectedAdminProfileVersion: 6,
      reason: "lost_device",
    })).resolves.toMatchObject({
      success: false,
      error: { code: "STALE_ADMIN_PROFILE_VERSION" },
    });
    expect(transaction.twoFactor.deleteMany).not.toHaveBeenCalled();
    expect(transaction.session.deleteMany).not.toHaveBeenCalled();
  });

  it("returns only an equivalent recovery replay after a fresh step-up", async () => {
    const transaction = transactionClient();
    transaction.adminSecurityOperation.findUnique.mockResolvedValue({
      kind: "operator_mfa_recovery",
      parameterFingerprint: "mismatch-first",
      status: "succeeded",
      targetUserId: operatorId,
      actorUserId: ownerId,
      committedTargetVersion: 8,
      revokedTargetSessions: 3,
    });
    mocks.transaction.mockImplementation(async (work) => work(transaction));
    await expect(recoverOperatorMfa({
      ...stepUp,
      targetUserId: operatorId,
      expectedAdminProfileVersion: 7,
      reason: "lost_device",
    })).resolves.toMatchObject({ success: false, error: { code: "DUPLICATE_OPERATION" } });
    expect(mocks.verifyAdminStepUp).toHaveBeenCalledTimes(1);
    expect(transaction.user.updateMany).not.toHaveBeenCalled();

    const matchingFingerprint = createHash("sha256").update(JSON.stringify({
      actorUserId: ownerId,
      expectedVersion: 7,
      kind: "operator_mfa_recovery",
      reason: "lost_device",
      targetUserId: operatorId,
    })).digest("hex");
    transaction.adminSecurityOperation.findUnique.mockResolvedValue({
      kind: "operator_mfa_recovery",
      parameterFingerprint: matchingFingerprint,
      status: "succeeded",
      targetUserId: operatorId,
      actorUserId: ownerId,
      committedTargetVersion: 8,
      revokedTargetSessions: 3,
    });
    await expect(recoverOperatorMfa({
      ...stepUp,
      targetUserId: operatorId,
      expectedAdminProfileVersion: 7,
      reason: "lost_device",
    })).resolves.toMatchObject({
      success: true,
      data: { replayed: true, adminProfileVersion: 8, revokedSessions: 3 },
    });
    expect(mocks.verifyAdminStepUp).toHaveBeenCalledTimes(2);
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it("creates a single 30-minute pending transfer without changing either profile", async () => {
    const transaction = transactionClient();
    transaction.ownershipTransfer.create.mockImplementation(({ data }: any) => Promise.resolve({
      id: "transfer-1",
      ...data,
      status: "pending",
      initiatedAt: new Date(),
      resolvedAt: null,
      owner: { name: "Current owner" },
      target: { name: "Target operator" },
    }));
    mocks.transaction.mockImplementation(async (work) => work(transaction));
    const before = Date.now();
    const result = await initiateOwnershipTransfer({
      ...stepUp,
      targetUserId: operatorId,
      expectedOwnerVersion: 3,
      expectedTargetVersion: 7,
    });
    expect(result).toMatchObject({ success: true, data: { transfer: { status: "pending" } } });
    const createData = transaction.ownershipTransfer.create.mock.calls[0][0].data;
    expect(createData.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 30 * 60 * 1_000);
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
    expect(transaction.$executeRaw).not.toHaveBeenCalled();
  });

  it("allows only the owner to initiate and rejects an ineligible target", async () => {
    const deniedTransaction = transactionClient();
    mocks.transaction.mockImplementationOnce(async (work) => work(deniedTransaction));
    mocks.requireAdminCapability.mockRejectedValueOnce(new AuthError("FORBIDDEN"));
    await expect(initiateOwnershipTransfer({
      ...stepUp,
      targetUserId: operatorId,
      expectedOwnerVersion: 3,
      expectedTargetVersion: 7,
    })).resolves.toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
    expect(deniedTransaction.adminSecurityOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "denied", safeFailureCode: "FORBIDDEN" }),
    });

    mocks.requireAdminCapability.mockResolvedValue(ownerSession);
    const transaction = transactionClient();
    transaction.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === ownerId ? readyOwner : { ...readyOperator, status: "suspended" }));
    mocks.transaction.mockImplementation(async (work) => work(transaction));
    await expect(initiateOwnershipTransfer({
      ...stepUp,
      targetUserId: operatorId,
      expectedOwnerVersion: 3,
      expectedTargetVersion: 7,
    })).resolves.toMatchObject({
      success: false,
      error: { code: "INVALID_OWNERSHIP_TARGET" },
    });
    expect(transaction.ownershipTransfer.create).not.toHaveBeenCalled();
  });

  it("enforces the singleton pending request and expires it authoritatively on read", async () => {
    const pendingTransaction = transactionClient();
    pendingTransaction.ownershipTransfer.findFirst.mockResolvedValue(pendingTransfer());
    mocks.transaction.mockImplementationOnce(async (work) => work(pendingTransaction));
    await expect(initiateOwnershipTransfer({
      ...stepUp,
      targetUserId: operatorId,
      expectedOwnerVersion: 3,
      expectedTargetVersion: 7,
    })).resolves.toMatchObject({
      success: false,
      error: { code: "OWNERSHIP_TRANSFER_PENDING" },
    });

    const expired = pendingTransfer({ expiresAt: new Date(Date.now() - 1_000) });
    const readTransaction = transactionClient();
    readTransaction.ownershipTransfer.findFirst.mockResolvedValue(expired);
    readTransaction.ownershipTransfer.updateMany.mockResolvedValue({ count: 1 });
    readTransaction.ownershipTransfer.findUnique.mockResolvedValue({
      ...expired,
      status: "expired",
      pendingKey: null,
      resolvedAt: new Date(),
    });
    mocks.requireActiveSession.mockResolvedValue(ownerSession);
    mocks.transaction.mockImplementationOnce(async (work) => work(readTransaction));
    await expect(getCurrentOwnershipTransfer()).resolves.toMatchObject({
      success: true,
      data: { status: "expired", canAccept: false, canCancel: false },
    });
    expect(readTransaction.ownershipTransfer.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "pending" }),
      data: expect.objectContaining({ status: "expired", pendingKey: null }),
    }));
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "ownership.transfer.expired",
    }), readTransaction);
  });

  it("accepts only as the recipient and swaps both profiles atomically without index-order dependence", async () => {
    const transaction = transactionClient();
    const transfer = pendingTransfer();
    mocks.verifyAdminStepUp.mockResolvedValue({ success: true, session: { session: { id: "operator-session" }, user: { id: operatorId } }, requestHeaders: headers });
    mocks.requireActiveSession.mockResolvedValue({ session: { id: "operator-session" }, user: { id: operatorId } });
    transaction.session.findUnique.mockResolvedValue({ userId: operatorId });
    transaction.ownershipTransfer.findUnique.mockResolvedValue(transfer);
    transaction.ownershipTransfer.update.mockResolvedValue({ ...transfer, status: "accepted", pendingKey: null, resolvedAt: new Date() });
    transaction.session.deleteMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 4 });
    mocks.transaction.mockImplementation(async (work) => work(transaction));

    const result = await acceptOwnershipTransfer({ ...stepUp, transferId: transfer.id });

    expect(result).toMatchObject({
      success: true,
      data: { revokedOwnerSessions: 2, revokedTargetSessions: 4, replayed: false },
    });
    expect(transaction.user.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ id: ownerId, adminProfile: "owner", adminProfileVersion: 3 }),
      data: { adminProfile: "operator", adminProfileVersion: 4 },
    }));
    expect(transaction.user.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ id: operatorId, adminProfile: "operator", adminProfileVersion: 7 }),
      data: { adminProfile: "owner", adminProfileVersion: 8 },
    }));
    expect(transaction.user.count).toHaveBeenLastCalledWith({
      where: { role: "platform_admin", adminProfile: "owner" },
    });
    expect(transaction.adminProfileMutation.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ kind: "transfer_demote_owner", toAdminProfile: "operator", targetVersion: 4 }),
        expect.objectContaining({ kind: "transfer_promote_owner", toAdminProfile: "owner", targetVersion: 8 }),
      ]),
    });
    expect(transaction.session.deleteMany).toHaveBeenCalledTimes(2);
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "ownership.transfer.accepted",
      outcome: "SUCCEEDED",
    }), transaction);
  });

  it("replays acceptance with stable owner/target session counts", async () => {
    const transaction = transactionClient();
    const transfer = pendingTransfer({ status: "accepted", pendingKey: null, resolvedAt: new Date() });
    const actorSession = {
      session: { id: "new-owner-session" },
      user: { id: operatorId },
    };
    mocks.verifyAdminStepUp.mockResolvedValue({ success: true, session: actorSession, requestHeaders: headers });
    mocks.requireActiveSession.mockResolvedValue(actorSession);
    const matchingFingerprint = createHash("sha256").update(JSON.stringify({
      actorUserId: operatorId,
      kind: "ownership_transfer_accept",
      transferId: transfer.id,
    })).digest("hex");
    transaction.adminSecurityOperation.findUnique.mockResolvedValue({
      kind: "ownership_transfer_accept",
      parameterFingerprint: matchingFingerprint,
      status: "succeeded",
      ownershipTransferId: transfer.id,
      revokedActorSessions: 4,
      revokedTargetSessions: 2,
    });
    transaction.ownershipTransfer.findUnique.mockResolvedValue(transfer);
    mocks.transaction.mockImplementation(async (work) => work(transaction));

    await expect(acceptOwnershipTransfer({ ...stepUp, transferId: transfer.id }))
      .resolves.toMatchObject({
        success: true,
        data: { replayed: true, revokedOwnerSessions: 2, revokedTargetSessions: 4 },
      });
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
    expect(transaction.session.deleteMany).not.toHaveBeenCalled();
  });

  it.each([
    ["cancel", ownerId, cancelOwnershipTransfer, "cancelled"],
    ["decline", operatorId, declineOwnershipTransfer, "declined"],
  ] as const)("applies the monotonic %s transition only for its participant", async (
    _label,
    actorId,
    resolve,
    expectedStatus,
  ) => {
    const transaction = transactionClient();
    const transfer = pendingTransfer();
    mocks.verifyAdminStepUp.mockResolvedValue({
      success: true,
      session: { session: { id: `${actorId}-session` }, user: { id: actorId } },
      requestHeaders: headers,
    });
    transaction.session.findUnique.mockResolvedValue({ userId: actorId });
    transaction.ownershipTransfer.findUnique.mockResolvedValue(transfer);
    transaction.ownershipTransfer.update.mockResolvedValue({
      ...transfer,
      status: expectedStatus,
      pendingKey: null,
      resolvedAt: new Date(),
    });
    mocks.transaction.mockImplementation(async (work) => work(transaction));

    await expect(resolve({ ...stepUp, transferId: transfer.id })).resolves.toMatchObject({
      success: true,
      data: { transfer: { status: expectedStatus }, replayed: false },
    });
    expect(transaction.$executeRaw).not.toHaveBeenCalled();
    expect(transaction.session.deleteMany).not.toHaveBeenCalled();
    expect(transaction.ownershipTransfer.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: expectedStatus, pendingKey: null }),
    }));
  });

  it("invalidates acceptance after a concurrent MFA or version change", async () => {
    const transaction = transactionClient();
    const transfer = pendingTransfer();
    mocks.verifyAdminStepUp.mockResolvedValue({
      success: true,
      session: { session: { id: "operator-session" }, user: { id: operatorId } },
      requestHeaders: headers,
    });
    transaction.session.findUnique.mockResolvedValue({ userId: operatorId });
    transaction.ownershipTransfer.findUnique.mockResolvedValue(transfer);
    transaction.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === ownerId
        ? readyOwner
        : { ...readyOperator, twoFactorEnabled: false, adminProfileVersion: 8 }));
    mocks.transaction.mockImplementation(async (work) => work(transaction));

    await expect(acceptOwnershipTransfer({ ...stepUp, transferId: transfer.id }))
      .resolves.toMatchObject({ success: false, error: { code: "STATE_CHANGED" } });
    expect(transaction.ownershipTransfer.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "invalidated", pendingKey: null }),
    }));
    expect(transaction.$executeRaw).not.toHaveBeenCalled();
    expect(transaction.session.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a non-recipient before any ownership swap", async () => {
    const transaction = transactionClient();
    const transfer = pendingTransfer();
    mocks.verifyAdminStepUp.mockResolvedValue({
      success: true,
      session: { session: { id: "other-session" }, user: { id: "other-operator" } },
      requestHeaders: headers,
    });
    transaction.ownershipTransfer.findUnique.mockResolvedValue(transfer);
    mocks.transaction.mockImplementation(async (work) => work(transaction));

    await expect(acceptOwnershipTransfer({ ...stepUp, transferId: transfer.id }))
      .resolves.toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
    expect(transaction.$executeRaw).not.toHaveBeenCalled();
    expect(transaction.session.deleteMany).not.toHaveBeenCalled();
  });
});
