import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ resolveCurrentWorkspace: mocks.resolve }));
vi.mock("@/lib/persistence/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

const current = { id: "client-a", name: "Ana", email: "ana@example.com", normalizedEmail: "ana@example.com",
  phone: null, normalizedPhone: null, company: null, address: null, notes: null, version: 2,
  createdAt: new Date("2026-09-01T00:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z") };
const tx = {
  workspace: { findFirst: vi.fn() }, session: { findFirst: vi.fn() }, auditEvent: { create: vi.fn() },
  client: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  serviceRequest: { count: vi.fn() }, recordPlan: { updateMany: vi.fn() }, operationReceipt: { updateMany: vi.fn() },
};

describe("client lifecycle mutations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.resolve.mockResolvedValue({ session: { session: { id: "session-a" }, user: { id: "user-a", role: "trial_user" } }, workspace: { id: "workspace-a" } });
    mocks.transaction.mockImplementation(async (operation) => operation(tx));
    tx.workspace.findFirst.mockResolvedValue({ id: "workspace-a" }); tx.session.findFirst.mockResolvedValue({ id: "session-a" });
    tx.client.findFirst.mockResolvedValue(current); tx.client.findMany.mockResolvedValue([]); tx.client.updateMany.mockResolvedValue({ count: 1 });
    tx.recordPlan.updateMany.mockResolvedValue({ count: 0 }); tx.operationReceipt.updateMany.mockResolvedValue({ count: 0 });
    tx.serviceRequest.count.mockResolvedValue(0); tx.client.deleteMany.mockResolvedValue({ count: 1 }); tx.auditEvent.create.mockResolvedValue({ id: "audit-a" });
  });

  it("rechecks normalized contacts and requires duplicate acknowledgment before editing", async () => {
    tx.client.findMany.mockResolvedValue([{ id: "client-b", name: "Other", email: "other@example.com", phone: "+12025550100", company: null, version: 1 }]);
    const { editClient } = await import("./client.services");
    const input = { id: "client-a", expectedVersion: 2, acknowledgeDuplicates: false,
      client: { name: " Ana ", email: " OTHER@EXAMPLE.COM ", phone: "", company: "", address: "", notes: "" } };
    const result = await editClient(input);
    expect(result).toMatchObject({ success: false, error: { code: "DUPLICATE_ACKNOWLEDGMENT_REQUIRED",
      details: { duplicates: [{ id: "client-b" }] } } });
    expect(tx.client.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId: "workspace-a", id: { not: "client-a" } }) }));
    expect(tx.client.updateMany).not.toHaveBeenCalled();
  });

  it("updates exactly the expected version and invalidates dependent prepared plans", async () => {
    const updated = { ...current, name: "Ana Updated", version: 3, updatedAt: new Date("2026-09-02T00:00:00Z") };
    tx.client.findFirst.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    const { editClient } = await import("./client.services");
    const result = await editClient({ id: "client-a", expectedVersion: 2, acknowledgeDuplicates: false,
      client: { name: "Ana Updated", email: "ana@example.com" } });
    expect(result).toMatchObject({ success: true, data: { version: 3, name: "Ana Updated" } });
    expect(tx.client.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "client-a", workspaceId: "workspace-a", version: 2 },
      data: expect.objectContaining({ version: { increment: 1 }, updatedByUserId: "user-a" }) }));
    expect(tx.recordPlan.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "workspace-a", selectedClientId: "client-a", status: "PREPARED" } }));
  });

  it("rejects stale edits and client deletion with dependent requests", async () => {
    const { editClient, deleteClient } = await import("./client.services");
    expect(await editClient({ id: "client-a", expectedVersion: 1, acknowledgeDuplicates: false,
      client: { name: "Ana", email: "ana@example.com" } })).toMatchObject({ success: false, error: { code: "STALE_VERSION" } });
    tx.client.findFirst.mockResolvedValue({ id: "client-a", version: 2, creationOperation: { planId: "plan-a" } });
    tx.serviceRequest.count.mockResolvedValue(2);
    expect(await deleteClient({ id: "client-a", expectedVersion: 2 })).toMatchObject({ success: false,
      error: { code: "CLIENT_HAS_REQUESTS", details: { requestCount: 2 } } });
    expect(tx.client.deleteMany).not.toHaveBeenCalled();
  });

  it("purges personal plan snapshots and detaches references before deletion", async () => {
    tx.client.findFirst.mockResolvedValue({ id: "client-a", version: 2, creationOperation: { planId: "plan-a" } });
    const { deleteClient } = await import("./client.services");
    expect(await deleteClient({ id: "client-a", expectedVersion: 2 })).toEqual({ success: true, data: { clientId: "client-a" } });
    expect(tx.operationReceipt.updateMany).toHaveBeenCalledWith({ where: { workspaceId: "workspace-a", selectedClientId: "client-a" }, data: { selectedClientId: null } });
    expect(tx.recordPlan.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "plan-a", workspaceId: "workspace-a" },
      data: expect.objectContaining({ payloadPurgedAt: expect.any(Date) }) }));
    expect(tx.client.deleteMany).toHaveBeenCalledWith({ where: { id: "client-a", workspaceId: "workspace-a", version: 2 } });
  });
});
