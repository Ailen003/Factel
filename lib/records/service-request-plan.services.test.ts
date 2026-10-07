import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ resolveCurrentWorkspace: mocks.resolve }));
vi.mock("@/lib/persistence/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

const tx = {
  workspace: { findFirst: vi.fn() }, session: { findFirst: vi.fn() }, client: { findFirst: vi.fn() },
  recordPlan: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() }, recordApproval: { create: vi.fn() },
  operationReceipt: { create: vi.fn(), update: vi.fn() }, serviceRequest: { create: vi.fn() }, auditEvent: { create: vi.fn() },
};
const session = { session: { id: "session-a" }, user: { id: "user-a", role: "trial_user" } };

describe("manual service request record plans", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.resolve.mockResolvedValue({ session, workspace: { id: "workspace-a" } });
    mocks.transaction.mockImplementation(async (operation) => operation(tx));
    tx.workspace.findFirst.mockResolvedValue({ id: "workspace-a" }); tx.session.findFirst.mockResolvedValue({ id: "session-a" });
    tx.client.findFirst.mockResolvedValue({ id: "client-a", name: "Ana", version: 3 });
    tx.recordPlan.create.mockResolvedValue({ id: "plan-a" }); tx.auditEvent.create.mockResolvedValue({ id: "audit-a" });
    tx.recordApproval.create.mockResolvedValue({ id: "approval-a" }); tx.operationReceipt.create.mockResolvedValue({ id: "receipt-a" });
    tx.serviceRequest.create.mockResolvedValue({ id: "request-a" }); tx.operationReceipt.update.mockResolvedValue({ id: "receipt-a" });
    tx.recordPlan.update.mockResolvedValue({ id: "plan-a" });
  });

  it("prepares an exact workspace-owned plan for an existing client", async () => {
    const { prepareServiceRequestCreation } = await import("./service-request-plan.services");
    const result = await prepareServiceRequestCreation({ clientId: "client-a", title: " Router ", description: " Install it ",
      serviceType: "installation", priority: "normal" });
    expect(result).toMatchObject({ success: true, data: { planId: "plan-a", client: { id: "client-a", name: "Ana" },
      request: { title: "Router", description: "Install it" } } });
    expect(tx.recordPlan.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      kind: "MANUAL_REQUEST_CREATE", selectedClientId: "client-a", selectedClientVersion: 3,
    }) }));
  });

  it("confirms once and commits approval, request, receipt and audit atomically", async () => {
    const { prepareServiceRequestCreation, confirmServiceRequestCreation } = await import("./service-request-plan.services");
    const prepared = await prepareServiceRequestCreation({ clientId: "client-a", title: "Router", description: "Install it",
      serviceType: "installation", priority: "high" });
    if (!prepared.success) throw new Error("prepare failed");
    const stored = { id: "plan-a", workspaceId: "workspace-a", createdByUserId: "user-a", kind: "MANUAL_REQUEST_CREATE",
      planHash: prepared.data.planHash, operationIntent: tx.recordPlan.create.mock.calls[0][0].data.operationIntent,
      status: "PREPARED", planVersion: 1, expiresAt: new Date(prepared.data.expiresAt), normalizedPayload: prepared.data.request,
      selectedClientVersion: 3, selectedClient: { id: "client-a", name: "Ana", version: 3 }, approvals: [], receipt: null };
    tx.recordPlan.findFirst.mockResolvedValue(stored);
    const result = await confirmServiceRequestCreation({ planId: "plan-a", planHash: prepared.data.planHash });
    expect(result).toEqual({ success: true, data: { requestId: "request-a", operationId: "receipt-a", replayed: false } });
    expect(tx.serviceRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      clientId: "client-a", serviceType: "INSTALLATION", priority: "HIGH", status: "PENDING",
    }) }));
  });

  it("reconciles a repeated confirmation from the existing receipt", async () => {
    tx.recordPlan.findFirst.mockResolvedValue({ id: "plan-a", workspaceId: "workspace-a", createdByUserId: "user-a",
      planHash: "a".repeat(64), operationIntent: "intent-a", status: "COMMITTED", planVersion: 1,
      expiresAt: new Date(0), approvals: [{}], selectedClient: null, selectedClientVersion: null,
      receipt: { id: "receipt-a", workspaceId: "workspace-a", actorUserId: "user-a", outcome: "SUCCEEDED", resultRequestIds: ["request-a"] } });
    const { confirmServiceRequestCreation } = await import("./service-request-plan.services");
    expect(await confirmServiceRequestCreation({ planId: "plan-a", planHash: "a".repeat(64) }))
      .toEqual({ success: true, data: { requestId: "request-a", operationId: "receipt-a", replayed: true } });
    expect(tx.serviceRequest.create).not.toHaveBeenCalled();
  });
});
