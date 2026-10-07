import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  writeAuthAudit: vi.fn(),
}));

vi.mock("@/lib/persistence/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));
vi.mock("./audit", () => ({ writeAuthAudit: mocks.writeAuthAudit }));

import { ownerMfaRecoverySchema, recoverOwnerMfaBreakGlass } from "./owner-mfa-recovery";

const owner = {
  id: "owner-1",
  email: "owner@example.test",
  role: "platform_admin",
  adminProfile: "owner",
  adminProfileVersion: 4,
  status: "active",
  temporaryPasswordChangeRequired: false,
  twoFactorEnabled: true,
  twoFactor: { id: "factor-1", verified: true },
  accounts: [{ id: "account-1" }],
  workspace: { lifecycle: "ACTIVE" },
};

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ lock_status: null }]),
    user: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([owner]),
      findUnique: vi.fn().mockResolvedValue(owner),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    adminSecurityOperation: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "operation-1" }),
    },
    twoFactor: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
    ...overrides,
  };
}

const input = {
  email: "OWNER@example.test",
  operationId: "7ae2d91d-7c20-4f60-a855-211c41c15912",
  reason: "lost_all_factors" as const,
  operationalReference: "INC-204",
  dryRun: false,
  confirmed: true,
  productionConfirmed: false,
};

describe("owner MFA break-glass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    mocks.writeAuthAudit.mockResolvedValue(undefined);
  });

  it("requires explicit confirmation and structured safe input", () => {
    expect(ownerMfaRecoverySchema.safeParse({ ...input, confirmed: false }).success).toBe(false);
    expect(ownerMfaRecoverySchema.safeParse({ ...input, operationalReference: "bad\nvalue" }).success).toBe(false);
  });

  it("is dry-run by behavior and does not mutate", async () => {
    const tx = transaction();
    mocks.transaction.mockImplementation((operation) => operation(tx));
    const result = await recoverOwnerMfaBreakGlass({
      ...input,
      dryRun: true,
      confirmed: false,
    });
    expect(result).toMatchObject({
      success: true,
      data: { dryRun: true, eligibleOwnerCount: 1, wouldMutate: true },
    });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.twoFactor.deleteMany).not.toHaveBeenCalled();
    expect(tx.session.deleteMany).not.toHaveBeenCalled();
  });

  it("removes only the factor state, increments version, revokes sessions and audits", async () => {
    const tx = transaction();
    mocks.transaction.mockImplementation((operation) => operation(tx));
    const result = await recoverOwnerMfaBreakGlass(input);
    expect(result).toMatchObject({
      success: true,
      data: { replayed: false, revokedSessions: 3 },
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { twoFactorEnabled: false, adminProfileVersion: { increment: 1 } },
    }));
    expect(tx.twoFactor.deleteMany).toHaveBeenCalledWith({
      where: { userId: owner.id, verified: true },
    });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: owner.id } });
    expect(tx.adminSecurityOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "owner_mfa_break_glass",
        recoveryReason: "lost_all_factors",
        operationalReference: "INC-204",
        status: "succeeded",
      }),
    });
    expect(mocks.writeAuthAudit).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(mocks.writeAuthAudit.mock.calls)).not.toContain("OWNER@example.test");
  });

  it("requires reinforced production confirmation", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(recoverOwnerMfaBreakGlass(input)).resolves.toMatchObject({
      success: false,
      error: { code: "PRODUCTION_CONFIRMATION_REQUIRED" },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a non-owner selection and never mutates", async () => {
    const tx = transaction();
    mocks.transaction.mockImplementation((operation) => operation(tx));
    const result = await recoverOwnerMfaBreakGlass({
      ...input,
      email: "different@example.test",
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: "OWNER_SELECTION_INVALID" },
    });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.twoFactor.deleteMany).not.toHaveBeenCalled();
    expect(tx.session.deleteMany).not.toHaveBeenCalled();
    expect(tx.adminSecurityOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "denied",
        safeFailureCode: "OWNER_SELECTION_INVALID",
      }),
    });

    const deniedFingerprint = tx.adminSecurityOperation.create.mock.calls[0][0].data.parameterFingerprint;
    const replayTx = transaction();
    replayTx.adminSecurityOperation.findUnique.mockResolvedValue({
      kind: "owner_mfa_break_glass",
      parameterFingerprint: deniedFingerprint,
      status: "denied",
      revokedTargetSessions: 0,
    });
    mocks.transaction.mockImplementationOnce((operation) => operation(replayTx));
    await expect(recoverOwnerMfaBreakGlass({
      ...input,
      email: "different@example.test",
      reason: "lost_device",
    })).resolves.toMatchObject({
      success: false,
      error: { code: "DUPLICATE_OPERATION" },
    });
    expect(replayTx.user.updateMany).not.toHaveBeenCalled();
  });

  it("fails closed unless exactly one consistent owner exists", async () => {
    const multipleOwnerTx = transaction();
    multipleOwnerTx.user.count.mockResolvedValue(2);
    multipleOwnerTx.user.findMany.mockResolvedValue([owner, { ...owner, id: "owner-2" }]);
    mocks.transaction.mockImplementationOnce((operation) => operation(multipleOwnerTx));
    await expect(recoverOwnerMfaBreakGlass(input)).resolves.toMatchObject({
      success: false,
      error: { code: "OWNER_COUNT_INVALID" },
    });

    const inconsistentOwnerTx = transaction();
    inconsistentOwnerTx.user.findUnique.mockResolvedValue({
      ...owner,
      twoFactorEnabled: false,
    });
    mocks.transaction.mockImplementationOnce((operation) => operation(inconsistentOwnerTx));
    await expect(recoverOwnerMfaBreakGlass(input)).resolves.toMatchObject({
      success: false,
      error: { code: "OWNER_STATE_INCONSISTENT" },
    });
    expect(inconsistentOwnerTx.user.updateMany).not.toHaveBeenCalled();
  });

  it("takes the shared ownership lock before the owner lock", async () => {
    const tx = transaction();
    mocks.transaction.mockImplementation((operation) => operation(tx));
    await expect(recoverOwnerMfaBreakGlass(input)).resolves.toMatchObject({ success: true });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    const renderedLocks = tx.$queryRaw.mock.calls.map(([query]) => JSON.stringify(query));
    expect(renderedLocks[0]).toContain("ownership-transfer");
    expect(renderedLocks[1]).toContain("admin-security:");
    expect(renderedLocks[2]).toContain(owner.id);
  });

  it("replays only the same completed operation without a second mutation", async () => {
    const tx = transaction();
    tx.adminSecurityOperation.findUnique.mockResolvedValue({
      kind: "owner_mfa_break_glass",
      parameterFingerprint: expect.anything(),
      status: "succeeded",
      targetUserId: owner.id,
      revokedTargetSessions: 3,
    });
    // Capture the first fingerprint, then replay it in a second transaction.
    mocks.transaction.mockImplementationOnce((operation) => operation(tx));
    const first = await recoverOwnerMfaBreakGlass(input);
    expect(first.success).toBe(false);

    const createdTx = transaction();
    mocks.transaction.mockImplementationOnce((operation) => operation(createdTx));
    const created = await recoverOwnerMfaBreakGlass(input);
    expect(created.success).toBe(true);
    const fingerprint = createdTx.adminSecurityOperation.create.mock.calls[0][0].data.parameterFingerprint;

    const replayTx = transaction();
    replayTx.adminSecurityOperation.findUnique.mockResolvedValue({
      kind: "owner_mfa_break_glass",
      parameterFingerprint: fingerprint,
      status: "succeeded",
      targetUserId: owner.id,
      revokedTargetSessions: 3,
    });
    mocks.transaction.mockImplementationOnce((operation) => operation(replayTx));
    await expect(recoverOwnerMfaBreakGlass(input)).resolves.toMatchObject({
      success: true,
      data: { replayed: true, revokedSessions: 3 },
    });
    expect(replayTx.user.updateMany).not.toHaveBeenCalled();
  });

  it("documents the privacy-safe silent CLI invocation", () => {
    const runbook = readFileSync(
      join(process.cwd(), "docs", "operations", "owner-mfa-break-glass.md"),
      "utf8",
    );
    const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
    expect(runbook).toContain("pnpm --silent auth:recover-owner-mfa");
    expect(runbook).not.toContain("\npnpm auth:recover-owner-mfa");
    expect(readme).toContain("pnpm --silent auth:recover-owner-mfa");
  });
});
