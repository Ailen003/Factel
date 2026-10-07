import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ resolveCurrentWorkspace: mocks.resolve }));
vi.mock("@/lib/persistence/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

const row = { id: "request-a", title: "Router", description: "Install", serviceType: "INSTALLATION", priority: "NORMAL",
  status: "PENDING", preferredSchedule: null, serviceAddress: null, nextSteps: null, version: 1,
  createdAt: new Date("2026-09-01T00:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z"),
  client: { id: "client-a", name: "Ana" } };
const tx = {
  workspace: { findFirst: vi.fn() }, session: { findFirst: vi.fn() }, client: { findFirst: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  serviceRequest: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), groupBy: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  recordPlan: { updateMany: vi.fn() }, auditEvent: { create: vi.fn() },
};

describe("workspace service request reads", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.resolve.mockResolvedValue({ session: { session: { id: "session-a" }, user: { id: "user-a", role: "trial_user" } }, workspace: { id: "workspace-a" } });
    mocks.transaction.mockImplementation(async (operation) => operation(tx));
    tx.workspace.findFirst.mockResolvedValue({ id: "workspace-a" }); tx.session.findFirst.mockResolvedValue({ id: "session-a" });
    tx.client.findFirst.mockResolvedValue({ id: "client-a" }); tx.serviceRequest.count.mockResolvedValue(12);
    tx.serviceRequest.findMany.mockResolvedValue([row]); tx.serviceRequest.findFirst.mockResolvedValue(row);
    tx.serviceRequest.groupBy.mockResolvedValue([{ status: "PENDING", _count: { _all: 7 } }, { status: "RESOLVED", _count: { _all: 5 } }]);
    tx.client.count.mockResolvedValue(1); tx.client.findMany.mockResolvedValue([{ id: "client-a", name: "Ana" }]);
    tx.serviceRequest.updateMany.mockResolvedValue({ count: 1 }); tx.serviceRequest.deleteMany.mockResolvedValue({ count: 1 });
    tx.recordPlan.updateMany.mockResolvedValue({ count: 1 }); tx.auditEvent.create.mockResolvedValue({ id: "audit-a" });
  });

  it("scopes filters, pagination and joined client data to the current workspace", async () => {
    const { getAllServiceRequests } = await import("./service-request.services");
    const result = await getAllServiceRequests({ page: 9, limit: 10, search: "router", clientId: "client-a",
      serviceType: "installation", priority: "normal", status: "pending", sortBy: "title", sortOrder: "asc" });
    expect(result).toMatchObject({ success: true, data: { requests: [{ id: "request-a", serviceType: "installation", status: "pending" }],
      pagination: { page: 2, total: 12 } } });
    expect(tx.serviceRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10,
      orderBy: [{ title: "asc" }, { id: "asc" }], where: expect.objectContaining({ workspaceId: "workspace-a", clientId: "client-a",
        serviceType: "INSTALLATION", priority: "NORMAL", status: "PENDING" }) }));
  });

  it("returns full client status statistics independently of the page", async () => {
    const { getClientServiceRequests } = await import("./service-request.services");
    const result = await getClientServiceRequests({ page: 1, limit: 10, clientId: "client-a", sortBy: "createdAt", sortOrder: "desc" });
    expect(result).toMatchObject({ success: true, data: { summary: { total: 12, pending: 7, resolved: 5, in_progress: 0, cancelled: 0 } } });
    expect(tx.serviceRequest.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "workspace-a", clientId: "client-a" } }));
  });

  it("hides inaccessible detail and selected catalog entries", async () => {
    tx.serviceRequest.findFirst.mockResolvedValue(null); tx.client.findFirst.mockResolvedValue(null);
    const services = await import("./service-request.services");
    expect(await services.getServiceRequestById("other")).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
    const catalog = await services.getClientCatalog({ page: 1, limit: 25, selectedId: "other" });
    expect(catalog).toMatchObject({ success: true, data: { options: [{ id: "client-a" }] } });
  });

  it("edits and reassigns a request with optimistic versioning and safe audit metadata", async () => {
    tx.serviceRequest.findFirst
      .mockResolvedValueOnce({ id: "request-a", version: 1, clientId: "client-a" })
      .mockResolvedValueOnce({ ...row, version: 2, client: { id: "client-b", name: "Bea" } });
    tx.client.findFirst.mockResolvedValue({ id: "client-b" });
    const { editServiceRequest } = await import("./service-request.services");
    const result = await editServiceRequest({ id: "request-a", expectedVersion: 1, request: {
      clientId: "client-b", title: " Router ", description: " Install ", serviceType: "installation",
      priority: "high", preferredSchedule: " Tomorrow ", serviceAddress: " Main St ", nextSteps: " Call ",
    } });
    expect(result).toMatchObject({ success: true, data: { id: "request-a", version: 2, client: { id: "client-b" } } });
    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "request-a", workspaceId: "workspace-a", version: 1 },
      data: expect.objectContaining({ clientId: "client-b", title: "Router", priority: "HIGH",
        updatedByUserId: "user-a", version: { increment: 1 } }),
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "service_request.update", outcome: "SUCCEEDED",
      safeMetadata: { reassigned: true, fromClientId: "client-a", toClientId: "client-b" },
    }) });
  });

  it("hides a cross-workspace reassignment target and audits the denial", async () => {
    tx.serviceRequest.findFirst.mockResolvedValueOnce({ id: "request-a", version: 1, clientId: "client-a" });
    tx.client.findFirst.mockResolvedValue(null);
    const { editServiceRequest } = await import("./service-request.services");
    const result = await editServiceRequest({ id: "request-a", expectedVersion: 1, request: {
      clientId: "other-client", title: "Router", description: "Install", serviceType: "installation", priority: "normal",
    } });
    expect(result).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
    expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      outcome: "DENIED", safeMetadata: { reason: "NOT_FOUND", reassigned: true,
        fromClientId: "client-a" },
    }) });
  });

  it("enforces the status policy before performing an optimistic update", async () => {
    tx.serviceRequest.findFirst.mockResolvedValueOnce({ id: "request-a", version: 1, status: "RESOLVED" });
    const { changeServiceRequestStatus } = await import("./service-request.services");
    const result = await changeServiceRequestStatus({ id: "request-a", expectedVersion: 1, status: "cancelled" });
    expect(result).toMatchObject({ success: false, error: { code: "INVALID_STATUS_TRANSITION" } });
    expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "service_request.status_change", outcome: "DENIED",
      safeMetadata: { reason: "INVALID_STATUS_TRANSITION", fromStatus: "resolved", toStatus: "cancelled" },
    }) });
  });

  it("reopens a resolved request to pending and increments its version", async () => {
    tx.serviceRequest.findFirst
      .mockResolvedValueOnce({ id: "request-a", version: 1, status: "RESOLVED" })
      .mockResolvedValueOnce({ ...row, status: "PENDING", version: 2 });
    const { changeServiceRequestStatus } = await import("./service-request.services");
    const result = await changeServiceRequestStatus({ id: "request-a", expectedVersion: 1, status: "pending" });
    expect(result).toMatchObject({ success: true, data: { status: "pending", version: 2 } });
    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "request-a", workspaceId: "workspace-a", version: 1 },
      data: { status: "PENDING", updatedByUserId: "user-a", version: { increment: 1 } },
    });
  });

  it("rejects stale status writes and records the attempted transition", async () => {
    tx.serviceRequest.findFirst.mockResolvedValueOnce({ id: "request-a", version: 2, status: "PENDING" });
    const { changeServiceRequestStatus } = await import("./service-request.services");
    const result = await changeServiceRequestStatus({ id: "request-a", expectedVersion: 1, status: "resolved" });
    expect(result).toMatchObject({ success: false, error: { code: "STALE_VERSION" } });
    expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "service_request.status_change", outcome: "DENIED",
      safeMetadata: { reason: "STALE_VERSION", fromStatus: "pending", toStatus: "resolved" },
    }) });
  });

  it("hard deletes only the request and purges its exclusive manual plan payload", async () => {
    tx.serviceRequest.findFirst.mockResolvedValueOnce({ id: "request-a", version: 1,
      creationOperation: { plan: { id: "plan-a", kind: "MANUAL_REQUEST_CREATE" }, createdRequests: [{ id: "request-a" }] } });
    const { deleteServiceRequest } = await import("./service-request.services");
    const result = await deleteServiceRequest({ id: "request-a", expectedVersion: 1 });
    expect(result).toEqual({ success: true, data: { requestId: "request-a" } });
    expect(tx.serviceRequest.deleteMany).toHaveBeenCalledWith({ where: {
      id: "request-a", workspaceId: "workspace-a", version: 1,
    } });
    expect(tx.recordPlan.updateMany).toHaveBeenCalledWith({
      where: { id: "plan-a", workspaceId: "workspace-a", kind: "MANUAL_REQUEST_CREATE" },
      data: { normalizedPayload: expect.anything(), duplicateCandidates: expect.anything(), payloadPurgedAt: expect.any(Date) },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "service_request.delete", outcome: "SUCCEEDED",
    }) });
  });

  it("preserves a shared or non-manual creation plan when deleting a request", async () => {
    tx.serviceRequest.findFirst.mockResolvedValueOnce({ id: "request-a", version: 1,
      creationOperation: { plan: { id: "plan-a", kind: "CONVERSATION_BATCH_CREATE" },
        createdRequests: [{ id: "request-a" }, { id: "request-b" }] } });
    const { deleteServiceRequest } = await import("./service-request.services");
    const result = await deleteServiceRequest({ id: "request-a", expectedVersion: 1 });
    expect(result).toEqual({ success: true, data: { requestId: "request-a" } });
    expect(tx.recordPlan.updateMany).not.toHaveBeenCalled();
  });
});
