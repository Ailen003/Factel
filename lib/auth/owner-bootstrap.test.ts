import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn(),
  writeAuthAudit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/audit", () => ({ writeAuthAudit: mocks.writeAuthAudit }));
vi.mock("@/lib/persistence/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      count: mocks.count,
    },
    $transaction: mocks.transaction,
  },
}));

import { bootstrapInitialOwner } from "./owner-bootstrap";

const input = {
  email: "admin@example.com",
  dryRun: false,
  confirmed: true,
  productionConfirmed: false,
  operationId: "11111111-1111-4111-8111-111111111111",
};

function transactionClient(options?: {
  owner?: { id: string } | null;
  targetProfile?: "owner" | "operator" | null;
  otherAdmins?: Array<{ id: string; adminProfileVersion: number }>;
}) {
  const targetProfile = options?.targetProfile ?? null;
  const userFindFirst = vi.fn().mockResolvedValue(options?.owner ?? null);
  const userFindUnique = vi.fn().mockResolvedValue({
    id: "admin-1",
    role: "platform_admin",
    adminProfile: targetProfile,
    adminProfileVersion: 0,
    status: "active",
  });
  const client = {
    $queryRaw: vi.fn().mockResolvedValue([{ lock_status: "" }]),
    user: {
      findUnique: userFindUnique,
      findFirst: userFindFirst,
      findMany: vi.fn().mockResolvedValue(options?.otherAdmins ?? []),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    adminProfileMutation: { create: vi.fn().mockResolvedValue({ id: "mutation-1" }) },
    auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
  return client;
}

describe("initial owner bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.writeAuthAudit.mockResolvedValue(undefined);
  });

  it("performs a read-only dry run for an explicit eligible administrator", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "admin-1",
      role: "platform_admin",
      adminProfile: null,
      status: "active",
    });
    mocks.findFirst.mockResolvedValue(null);
    mocks.count.mockResolvedValue(3);

    await expect(bootstrapInitialOwner({ ...input, dryRun: true, confirmed: false }))
      .resolves.toEqual({
        success: true,
        data: {
          dryRun: true,
          idempotent: false,
          ownerUserId: "admin-1",
          operatorsAssigned: 2,
          sessionsRevoked: 0,
        },
      });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before connecting for a mutation", async () => {
    await expect(bootstrapInitialOwner({ ...input, confirmed: false })).resolves.toMatchObject({
      success: false,
      error: { code: "CONFIRMATION_REQUIRED" },
    });
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("assigns one owner, assigns remaining admins as operators, revokes sessions, and audits", async () => {
    const client = transactionClient({
      otherAdmins: [{ id: "admin-2", adminProfileVersion: 4 }],
    });
    mocks.transaction.mockImplementation(async (operation) => operation(client));

    await expect(bootstrapInitialOwner(input)).resolves.toEqual({
      success: true,
      data: {
        dryRun: false,
        idempotent: false,
        ownerUserId: "admin-1",
        operatorsAssigned: 1,
        sessionsRevoked: 4,
      },
    });
    expect(client.$queryRaw).toHaveBeenCalledOnce();
    expect(client.user.updateMany).toHaveBeenCalledTimes(2);
    expect(client.session.deleteMany).toHaveBeenCalledTimes(2);
    expect(client.adminProfileMutation.create).toHaveBeenCalledTimes(2);
    expect(mocks.writeAuthAudit).toHaveBeenCalledTimes(2);
  });

  it("is idempotent for the same existing owner", async () => {
    const client = transactionClient({ owner: { id: "admin-1" }, targetProfile: "owner" });
    mocks.transaction.mockImplementation(async (operation) => operation(client));

    await expect(bootstrapInitialOwner(input)).resolves.toMatchObject({
      success: true,
      data: { idempotent: true, operatorsAssigned: 0, sessionsRevoked: 0 },
    });
    expect(client.user.updateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuthAudit).not.toHaveBeenCalled();
  });

  it("rejects a different owner without mutation", async () => {
    const client = transactionClient({ owner: { id: "admin-2" } });
    mocks.transaction.mockImplementation(async (operation) => operation(client));

    await expect(bootstrapInitialOwner(input)).resolves.toMatchObject({
      success: false,
      error: { code: "OWNER_ALREADY_EXISTS" },
    });
    expect(client.user.updateMany).not.toHaveBeenCalled();
  });

  it("blocks production mutation without the additional confirmation", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(bootstrapInitialOwner(input)).resolves.toMatchObject({
      success: false,
      error: { code: "PRODUCTION_CONFIRMATION_REQUIRED" },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
