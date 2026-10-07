import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  requireAdminCapability: vi.fn(),
  writeAuthAudit: vi.fn(),
  generateTemporaryPassword: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/auth", () => ({
  auth: { api: { createUser: mocks.createUser } },
}));
vi.mock("@/lib/auth/admin-authorization", () => ({
  requireAdminCapability: mocks.requireAdminCapability,
}));
vi.mock("@/lib/auth/audit", () => ({ writeAuthAudit: mocks.writeAuthAudit }));
vi.mock("@/lib/auth/temporary-credential", () => ({
  generateTemporaryPassword: mocks.generateTemporaryPassword,
}));
vi.mock("@/lib/persistence/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
    },
    $transaction: mocks.transaction,
  },
}));

describe("user administration service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.requireAdminCapability.mockResolvedValue({
      user: { id: "admin-1", adminProfile: "owner" },
    });
    mocks.findUnique.mockResolvedValue(null);
    mocks.findFirst.mockResolvedValue(null);
    mocks.writeAuthAudit.mockResolvedValue(undefined);
    mocks.generateTemporaryPassword.mockReturnValue("server-generated-temporary-password");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.useRealTimers();
  });

  it("provisions an administrator-authorized account with a 72-hour temporary credential", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T09:00:00.000Z"));
    const created = {
      id: "trial-new",
      email: "trial-new@example.com",
      name: "New Trial",
      role: "trial_user",
      adminProfile: null,
      adminProfileVersion: 0,
      status: "active",
      locale: "en",
      initialCreditAllocation: 10,
      temporaryPasswordChangeRequired: true,
      temporaryPasswordExpiresAt: new Date("2026-09-12T09:00:00.000Z"),
      temporaryPasswordPurpose: "activation",
      trialActivatedAt: null,
      trialExpiresAt: null,
      createdAt: new Date("2026-09-09T09:00:00.000Z"),
      updatedAt: new Date("2026-09-09T09:00:00.000Z"),
      accounts: [{ id: "credential-1" }],
      workspace: { id: "workspace-new" },
    };
    const transactionClient = {
      user: {
        update: vi.fn().mockResolvedValue(created),
        findUnique: vi.fn().mockResolvedValue(created),
      },
      workspace: {
        findUnique: vi.fn().mockResolvedValue({ creditInitializedAt: null, owner: { initialCreditAllocation: 10 } }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      creditEntry: { create: vi.fn().mockResolvedValue({ id: "credit-1" }) },
    };
    mocks.createUser.mockResolvedValue({ user: { id: "trial-new" } });
    mocks.transaction.mockImplementation(async (operation) => operation(transactionClient));
    const { createUser } = await import("../user.services");

    const result = await createUser({
      name: "New Trial",
      email: "trial-new@example.com",
      locale: "en",
      initialCreditAllocation: 10,
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        temporaryPassword: "server-generated-temporary-password",
        temporaryPasswordExpiresAt: "2026-09-12T09:00:00.000Z",
        user: {
          adminProfile: null,
          adminProfileVersion: 0,
          temporaryPasswordChangeRequired: true,
          temporaryPasswordPurpose: "activation",
          trialActivatedAt: null,
          trialExpiresAt: null,
        },
      },
    });
    expect(mocks.requireAdminCapability).toHaveBeenCalledWith("trial.create");
    expect(transactionClient.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        temporaryPasswordChangeRequired: true,
        temporaryPasswordExpiresAt: new Date("2026-09-12T09:00:00.000Z"),
        temporaryPasswordPurpose: "activation",
      }),
    }));
    expect(mocks.createUser).toHaveBeenCalledWith({
      body: {
        name: "New Trial",
        email: "trial-new@example.com",
        password: "server-generated-temporary-password",
        role: "trial_user",
      },
    });
    const auditInput = mocks.writeAuthAudit.mock.calls.find(([input]) => input.outcome === "SUCCEEDED")?.[0];
    expect(JSON.stringify(auditInput)).not.toContain("server-generated-temporary-password");
  });

  it("denies provisioning when the actor is not an administrator", async () => {
    mocks.requireAdminCapability.mockRejectedValueOnce(new AuthError("FORBIDDEN"));
    const { createUser } = await import("../user.services");
    await expect(createUser({
      name: "New Trial",
      email: "trial-new@example.com",
      locale: "en",
      initialCreditAllocation: 10,
    })).resolves.toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("does not claim or delete a user by email when Better Auth returns no id", async () => {
    mocks.createUser.mockRejectedValue(new Error("credential link failed"));
    const { createUser } = await import("../user.services");

    const result = await createUser({
      name: "Provisioning Test",
      email: "provisioning@example.com",
      locale: "es",
      initialCreditAllocation: 12,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: "PROVISIONING_FAILED" },
    });
    expect(mocks.findUnique).toHaveBeenCalledTimes(1);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { email: "provisioning@example.com" },
      select: { id: true },
    });
    expect(mocks.createUser).toHaveBeenCalledWith({
      body: {
        name: "Provisioning Test",
        email: "provisioning@example.com",
        password: "server-generated-temporary-password",
        role: "trial_user",
      },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "user.create",
      outcome: "FAILED",
      targetUserId: null,
      safeMetadata: expect.objectContaining({ compensation: "not-owned" }),
    }));
  });

  it("writes a successful user mutation audit through the same transaction", async () => {
    const existing = {
      id: "user-1",
      email: "user@example.com",
      name: "Before",
      role: "trial_user",
      status: "active",
      locale: "en",
      initialCreditAllocation: 10,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const updated = {
      ...existing,
      name: "After",
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    const transactionClient = {
      user: {
        findFirst: vi.fn().mockResolvedValue(existing),
        count: vi.fn().mockResolvedValue(2),
        update: vi.fn().mockResolvedValue(updated),
      },
    };
    mocks.transaction.mockImplementation(async (operation) => operation(transactionClient));
    const { editUser } = await import("../user.services");

    const result = await editUser("user-1", { name: "After", locale: "es" });

    expect(result).toMatchObject({ success: true, data: { fullName: "After" } });
    expect(mocks.requireAdminCapability).toHaveBeenCalledWith("trial.update");
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "user.update",
      outcome: "SUCCEEDED",
      targetUserId: "user-1",
    }), transactionClient);
  });

  it("denies an operator edit of an administrator and audits inside the transaction", async () => {
    mocks.requireAdminCapability.mockResolvedValueOnce({
      user: { id: "operator-1", adminProfile: "operator" },
    });
    const transactionClient = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: "admin-2",
          role: "platform_admin",
          adminProfile: "operator",
          status: "active",
        }),
        update: vi.fn(),
      },
    };
    mocks.transaction.mockImplementation(async (operation) => operation(transactionClient));
    const { editUser } = await import("../user.services");

    const result = await editUser("admin-2", { name: "No", locale: "en" });

    expect(result).toMatchObject({
      success: false,
      error: { code: "ADMIN_TARGET_FORBIDDEN" },
    });
    expect(transactionClient.user.update).not.toHaveBeenCalled();
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.update",
        outcome: "DENIED",
        safeMetadata: { reason: "ADMIN_TARGET_FORBIDDEN" },
      }),
      transactionClient,
    );
  });

  it("clamps a stale page after the result set shrinks", async () => {
    const records = [
      {
        id: "user-6",
        email: "six@example.com",
        name: "Six",
        role: "trial_user",
        status: "active",
        locale: "en",
        initialCreditAllocation: 10,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    const transactionClient = {
      user: {
        count: vi.fn().mockResolvedValue(6),
        findMany: vi.fn().mockResolvedValue(records),
      },
    };
    mocks.transaction.mockImplementation(async (operation) => operation(transactionClient));
    const { getAllUsers } = await import("../user.services");

    const result = await getAllUsers({
      page: 4,
      limit: 5,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(mocks.requireAdminCapability).toHaveBeenCalledWith("trial.read");
    expect(transactionClient.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
    expect(result).toMatchObject({
      success: true,
      data: { pagination: { page: 2, total: 6, totalPages: 2 } },
    });
  });

  it("maps only authoritative MFA readiness flags without exposing factor data", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "admin-2",
      email: "operator@example.com",
      name: "Ready Operator",
      role: "platform_admin",
      adminProfile: "operator",
      adminProfileVersion: 4,
      twoFactorEnabled: true,
      twoFactor: { verified: true },
      status: "active",
      locale: "en",
      initialCreditAllocation: 10,
      temporaryPasswordChangeRequired: false,
      temporaryPasswordExpiresAt: null,
      temporaryPasswordPurpose: null,
      temporaryCredentialVersion: 0,
      temporaryCredentialTargets: [],
      trialActivatedAt: null,
      trialExpiresAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const { getUserById } = await import("../user.services");

    const result = await getUserById("admin-2");

    expect(result).toMatchObject({
      success: true,
      data: { twoFactorEnabled: true, twoFactorVerified: true },
    });
    if (result.success) expect(result.data).not.toHaveProperty("twoFactor");
  });

  it("compensates an audit failure using only the id returned by Better Auth", async () => {
    const created = {
      id: "owned-user-1",
      email: "owned@example.com",
      name: "Owned User",
      role: "trial_user",
      status: "active",
      locale: "es",
      initialCreditAllocation: 10,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      accounts: [{ id: "account-1" }],
      workspace: { id: "workspace-1" },
    };
    const provisioningTransaction = {
      user: {
        update: vi.fn().mockResolvedValue(created),
        findUnique: vi.fn().mockResolvedValue(created),
      },
      workspace: {
        findUnique: vi.fn().mockResolvedValue({
          creditInitializedAt: null,
          owner: { initialCreditAllocation: 15 },
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      creditEntry: { create: vi.fn().mockResolvedValue({ id: "grant-1" }) },
    };
    const compensationTransaction = {
      workspace: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      user: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    mocks.createUser.mockResolvedValue({ user: { id: "owned-user-1" } });
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(provisioningTransaction))
      .mockImplementationOnce(async (operation) => operation(compensationTransaction));
    mocks.writeAuthAudit
      .mockRejectedValueOnce(new Error("audit unavailable"))
      .mockResolvedValueOnce(undefined);
    const { createUser } = await import("../user.services");

    const result = await createUser({
      name: "Owned User",
      email: "owned@example.com",
      locale: "es",
      initialCreditAllocation: 15,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: "PROVISIONING_FAILED" },
    });
    expect(provisioningTransaction.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        locale: "es",
        initialCreditAllocation: 15,
        temporaryPasswordChangeRequired: true,
        temporaryPasswordExpiresAt: expect.any(Date),
        temporaryPasswordPurpose: "activation",
        trialActivatedAt: null,
        trialExpiresAt: null,
      }),
    }));
    expect(provisioningTransaction.creditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "GRANT", quantity: 15 }),
    });
    expect(compensationTransaction.workspace.deleteMany).toHaveBeenCalledWith({
      where: { ownerId: "owned-user-1" },
    });
    expect(compensationTransaction.user.deleteMany).toHaveBeenCalledWith({
      where: { id: "owned-user-1" },
    });
    expect(mocks.findUnique).toHaveBeenCalledTimes(1);
  });

  it("suspends another user and revokes sessions in the audited transaction", async () => {
    const existing = {
      id: "user-1",
      email: "user@example.com",
      name: "Trial User",
      role: "trial_user",
      status: "active",
      locale: "en",
      initialCreditAllocation: 10,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const updated = { ...existing, status: "suspended" };
    const transactionClient = {
      user: {
        findFirst: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue(updated),
      },
      session: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    mocks.transaction.mockImplementation(async (operation) => operation(transactionClient));
    const { setUserStatus } = await import("../user.services");

    const result = await setUserStatus("user-1", "suspended");

    expect(result).toMatchObject({
      success: true,
      data: { user: { status: "suspended" }, revokedSessions: 2 },
    });
    expect(mocks.requireAdminCapability).toHaveBeenCalledWith("trial.suspend");
    expect(transactionClient.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "user.status_change",
      outcome: "SUCCEEDED",
      safeMetadata: expect.objectContaining({ revokedSessions: 2 }),
    }), transactionClient);
  });

  it("treats revoking zero sessions as an idempotent success", async () => {
    const transactionClient = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: "user-1" }) },
      session: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    mocks.transaction.mockImplementation(async (operation) => operation(transactionClient));
    const { revokeUserSessions } = await import("../user.services");

    const result = await revokeUserSessions("user-1");

    expect(result).toEqual({
      success: true,
      data: { userId: "user-1", revokedSessions: 0 },
    });
    expect(mocks.requireAdminCapability).toHaveBeenCalledWith("trial.sessions.revoke");
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "user.sessions_revoke",
      outcome: "SUCCEEDED",
    }), transactionClient);
  });

  it("blocks account deletion without mutation when managed domain data exists", async () => {
    const transactionClient = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: "user-1",
          role: "trial_user",
          workspace: { id: "workspace-1" },
        }),
        findUnique: vi.fn().mockResolvedValue({ _count: {} }),
        delete: vi.fn(),
      },
      workspace: {
        findUnique: vi.fn().mockResolvedValue({ _count: { conversations: 1 } }),
        update: vi.fn(),
        delete: vi.fn(),
      },
      session: { deleteMany: vi.fn() },
      auditEvent: { updateMany: vi.fn() },
    };
    mocks.transaction.mockImplementation(async (operation) => operation(transactionClient));
    const { deleteManagedUser } = await import("../user.services");

    const result = await deleteManagedUser("user-1");

    expect(result).toMatchObject({ success: false, error: { code: "ACCOUNT_HAS_MANAGED_DATA" } });
    expect(transactionClient.session.deleteMany).not.toHaveBeenCalled();
    expect(transactionClient.workspace.delete).not.toHaveBeenCalled();
    expect(transactionClient.user.delete).not.toHaveBeenCalled();
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "user.delete",
      outcome: "DENIED",
    }), transactionClient);
  });

  it("deletes an identity-only trial account while preserving detached audit proof", async () => {
    const transactionClient = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: "user-1",
          role: "trial_user",
          workspace: { id: "workspace-1" },
        }),
        findUnique: vi.fn().mockResolvedValue({ _count: {} }),
        delete: vi.fn().mockResolvedValue({ id: "user-1" }),
      },
      workspace: {
        findUnique: vi.fn().mockResolvedValue({ _count: {} }),
        update: vi.fn().mockResolvedValue({ id: "workspace-1" }),
        delete: vi.fn().mockResolvedValue({ id: "workspace-1" }),
      },
      session: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditEvent: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    mocks.transaction.mockImplementation(async (operation) => operation(transactionClient));
    const { deleteManagedUser } = await import("../user.services");

    const result = await deleteManagedUser("user-1");

    expect(result).toEqual({
      success: true,
      data: { userId: "user-1", revokedSessions: 1 },
    });
    expect(mocks.requireAdminCapability).toHaveBeenCalledWith("trial.delete");
    expect(transactionClient.auditEvent.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1" },
      data: { workspaceId: null },
    });
    expect(transactionClient.workspace.delete).toHaveBeenCalledWith({ where: { id: "workspace-1" } });
    expect(transactionClient.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "user.delete",
      outcome: "SUCCEEDED",
    }), transactionClient);
  });
});
