import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  requireAdminCapability: vi.fn(),
  writeAuthAudit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/admin-authorization", () => ({
  requireAdminCapability: mocks.requireAdminCapability,
}));
vi.mock("@/lib/auth/audit", () => ({ writeAuthAudit: mocks.writeAuthAudit }));
vi.mock("@/lib/persistence/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

import {
  demoteOperatorToTrialUser,
  promoteUserToOperator,
} from "../admin-profile-mutation.services";

const targetUserId = "6f2de4f9-6c16-4e2f-886f-df0ed584e571";
const operationId = "c675eab5-ef07-40df-bc50-74c9b4dd5e98";
const dto = {
  operationId,
  targetUserId,
  expectedVersion: 2,
  confirmed: true as const,
};

function transactionClient(target: Record<string, unknown>) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ lock_status: "" }]),
    adminProfileMutation: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "ledger-1" }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(target),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    twoFactor: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
  };
}

const promotableTarget = {
  id: targetUserId,
  role: "trial_user",
  adminProfile: null,
  adminProfileVersion: 2,
  status: "active",
  accounts: [{ id: "credential-1" }],
  workspace: { id: "workspace-1", lifecycle: "ACTIVE" },
};

const operatorTarget = {
  ...promotableTarget,
  role: "platform_admin",
  adminProfile: "operator",
};

describe("administrator profile mutation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminCapability.mockResolvedValue({
      user: { id: "owner-1", adminProfile: "owner" },
    });
    mocks.writeAuthAudit.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("promotes a ready trial user under the target lock and revokes sessions", async () => {
    const transaction = transactionClient(promotableTarget);
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));

    const result = await promoteUserToOperator(dto);

    expect(result).toEqual({
      success: true,
      data: {
        userId: targetUserId,
        adminProfile: "operator",
        adminProfileVersion: 3,
        revokedSessions: 3,
        replayed: false,
      },
    });
    expect(mocks.requireAdminCapability).toHaveBeenCalledWith("admin.manage");
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.user.findUnique.mock.invocationCallOrder[0],
    );
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable", timeout: 15_000 },
    );
    expect(transaction.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: targetUserId,
        role: "trial_user",
        adminProfile: null,
        adminProfileVersion: 2,
        status: "active",
      },
      data: {
        role: "platform_admin",
        adminProfile: "operator",
        adminProfileVersion: 3,
      },
    });
    expect(transaction.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: targetUserId },
    });
    expect(transaction.adminProfileMutation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        operationId,
        kind: "promote_operator",
        targetVersion: 3,
        revokedSessions: 3,
      }),
    });
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.profile.promote",
        outcome: "SUCCEEDED",
        correlationId: operationId,
      }),
      transaction,
    );
  });

  it("returns a matching operation replay without another mutation or audit", async () => {
    const transaction = transactionClient(promotableTarget);
    transaction.adminProfileMutation.findUnique.mockResolvedValue({
      kind: "promote_operator",
      targetUserId,
      toRole: "platform_admin",
      toAdminProfile: "operator",
      targetVersion: 3,
      revokedSessions: 2,
    });
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));

    const result = await promoteUserToOperator(dto);

    expect(result).toMatchObject({
      success: true,
      data: { replayed: true, revokedSessions: 2, adminProfileVersion: 3 },
    });
    expect(transaction.user.findUnique).not.toHaveBeenCalled();
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuthAudit).not.toHaveBeenCalled();
  });

  it("rejects a reused operation id whose target or result does not match", async () => {
    const transaction = transactionClient(promotableTarget);
    transaction.adminProfileMutation.findUnique.mockResolvedValue({
      kind: "demote_operator",
      targetUserId,
      toRole: "trial_user",
      toAdminProfile: null,
      targetVersion: 3,
      revokedSessions: 0,
    });
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));

    await expect(promoteUserToOperator(dto)).resolves.toMatchObject({
      success: false,
      error: { code: "DUPLICATE_OPERATION" },
    });
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.profile.promote",
        outcome: "DENIED",
        safeMetadata: { reason: "DUPLICATE_OPERATION" },
      }),
      transaction,
    );
  });

  it("rejects stale and unready promotion targets without partial mutation", async () => {
    const stale = transactionClient({ ...promotableTarget, adminProfileVersion: 3 });
    const unready = transactionClient({ ...promotableTarget, accounts: [] });
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(stale))
      .mockImplementationOnce(async (operation) => operation(unready));

    await expect(promoteUserToOperator(dto)).resolves.toMatchObject({
      success: false,
      error: { code: "STALE_ADMIN_PROFILE_VERSION" },
    });
    await expect(promoteUserToOperator(dto)).resolves.toMatchObject({
      success: false,
      error: { code: "INVALID_ADMIN_PROFILE_TARGET" },
    });
    expect(stale.user.updateMany).not.toHaveBeenCalled();
    expect(unready.user.updateMany).not.toHaveBeenCalled();
    expect(stale.session.deleteMany).not.toHaveBeenCalled();
    expect(unready.session.deleteMany).not.toHaveBeenCalled();
  });

  it("demotes an operator, writes the ledger, and protects owners", async () => {
    const demotion = transactionClient(operatorTarget);
    const protectedOwner = transactionClient({
      ...operatorTarget,
      id: "owner-1",
      adminProfile: "owner",
    });
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(demotion))
      .mockImplementationOnce(async (operation) => operation(protectedOwner));

    const result = await demoteOperatorToTrialUser(dto);
    const denied = await demoteOperatorToTrialUser({
      ...dto,
      operationId: "f1da9a9d-44f7-4de7-b781-8dcf8d0b97f5",
      targetUserId: "owner-1",
    });

    expect(result).toMatchObject({
      success: true,
      data: { adminProfile: null, adminProfileVersion: 3, revokedSessions: 3 },
    });
    expect(demotion.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: "trial_user",
          adminProfile: null,
          twoFactorEnabled: false,
        }),
      }),
    );
    expect(demotion.twoFactor.deleteMany).toHaveBeenCalledWith({
      where: { userId: targetUserId },
    });
    expect(demotion.adminProfileMutation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "demote_operator" }),
    });
    expect(denied).toMatchObject({
      success: false,
      error: { code: "OWNER_PROTECTED" },
    });
    expect(protectedOwner.user.updateMany).not.toHaveBeenCalled();
  });

  it("blocks demotion when the operator cannot become a valid trial user", async () => {
    const missingCredential = transactionClient({
      ...operatorTarget,
      accounts: [],
    });
    mocks.transaction.mockImplementation(async (operation) => operation(missingCredential));

    await expect(demoteOperatorToTrialUser(dto)).resolves.toMatchObject({
      success: false,
      error: { code: "ADMIN_PROFILE_DEMOTION_BLOCKED" },
    });
    expect(missingCredential.user.updateMany).not.toHaveBeenCalled();
    expect(missingCredential.session.deleteMany).not.toHaveBeenCalled();
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.profile.demote",
        outcome: "DENIED",
        safeMetadata: { reason: "ADMIN_PROFILE_DEMOTION_BLOCKED" },
      }),
      missingCredential,
    );
  });

  it("fails closed when authorization or transactional audit fails", async () => {
    mocks.requireAdminCapability.mockRejectedValueOnce(new AuthError("FORBIDDEN"));
    await expect(promoteUserToOperator(dto)).resolves.toMatchObject({
      success: false,
      error: { code: "FORBIDDEN" },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();

    const transaction = transactionClient(promotableTarget);
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));
    mocks.writeAuthAudit.mockRejectedValueOnce(new Error("audit unavailable"));
    await expect(promoteUserToOperator(dto)).resolves.toMatchObject({
      success: false,
      error: { code: "INTERNAL_ERROR" },
    });
    expect(mocks.writeAuthAudit).toHaveBeenLastCalledWith(expect.objectContaining({
      action: "admin.profile.promote",
      outcome: "FAILED",
      correlationId: operationId,
      safeMetadata: { reason: "INTERNAL_ERROR" },
    }));
  });
});
