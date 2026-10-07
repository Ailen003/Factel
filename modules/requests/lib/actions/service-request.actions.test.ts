import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(), clientList: vi.fn(), details: vi.fn(), catalog: vi.fn(), prepare: vi.fn(), confirm: vi.fn(),
  edit: vi.fn(), changeStatus: vi.fn(), remove: vi.fn(),
}));
vi.mock("../services/service-request.services", () => ({
  getAllServiceRequests: mocks.list, getClientServiceRequests: mocks.clientList,
  getServiceRequestById: mocks.details, getClientCatalog: mocks.catalog,
  editServiceRequest: mocks.edit, changeServiceRequestStatus: mocks.changeStatus,
  deleteServiceRequest: mocks.remove,
}));
vi.mock("@/lib/records/service-request-plan.services", () => ({
  prepareServiceRequestCreation: mocks.prepare, confirmServiceRequestCreation: mocks.confirm,
}));

describe("service request action validation", () => {
  beforeEach(() => vi.resetAllMocks());

  it("validates and delegates manual request preparation", async () => {
    mocks.prepare.mockResolvedValue({ success: true, data: { planId: "plan-a" } });
    const { prepareServiceRequestCreationAction } = await import("./service-request.actions");
    const input = { clientId: "client-a", title: " Router ", description: " Install it ", serviceType: "installation" };
    expect(await prepareServiceRequestCreationAction(input)).toMatchObject({ success: true });
    expect(mocks.prepare).toHaveBeenCalledWith(expect.objectContaining({ clientId: "client-a", title: "Router", priority: "normal" }));
  });

  it("rejects scope/status injection and mutable confirmation payloads", async () => {
    const actions = await import("./service-request.actions");
    const base = { clientId: "client-a", title: "Router", description: "Install", serviceType: "installation" };
    expect(await actions.prepareServiceRequestCreationAction({ ...base, workspaceId: "other" })).toMatchObject({ success: false });
    expect(await actions.prepareServiceRequestCreationAction({ ...base, status: "resolved" })).toMatchObject({ success: false });
    expect(await actions.confirmServiceRequestCreationAction({ planId: "plan-a", planHash: "a".repeat(64), request: base })).toMatchObject({ success: false });
    expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("requires a concrete client for the embedded client list", async () => {
    const { getClientServiceRequestsAction } = await import("./service-request.actions");
    expect(await getClientServiceRequestsAction({ page: 1, limit: 10 })).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(mocks.clientList).not.toHaveBeenCalled();
  });

  it("validates strict edit input and delegates the normalized payload", async () => {
    mocks.edit.mockResolvedValue({ success: true, data: { id: "request-a" } });
    const { editServiceRequestAction } = await import("./service-request.actions");
    const request = { clientId: "client-a", title: " Router ", description: " Install ",
      serviceType: "installation", priority: "high", preferredSchedule: " Tomorrow " };
    await expect(editServiceRequestAction({ id: "request-a", expectedVersion: 2, request }))
      .resolves.toMatchObject({ success: true });
    expect(mocks.edit).toHaveBeenCalledWith({ id: "request-a", expectedVersion: 2,
      request: expect.objectContaining({ title: "Router", description: "Install", preferredSchedule: "Tomorrow" }) });
    await expect(editServiceRequestAction({ id: "request-a", expectedVersion: 2,
      request: { ...request, status: "resolved" } })).resolves.toMatchObject({ success: false,
      error: { code: "VALIDATION_ERROR" } });
  });

  it("rejects invalid mutation versions, statuses and injected workspace scope", async () => {
    const actions = await import("./service-request.actions");
    await expect(actions.changeServiceRequestStatusAction({ id: "request-a", expectedVersion: 0, status: "resolved" }))
      .resolves.toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    await expect(actions.changeServiceRequestStatusAction({ id: "request-a", expectedVersion: 1, status: "closed" }))
      .resolves.toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    await expect(actions.deleteServiceRequestAction({ id: "request-a", expectedVersion: 1, workspaceId: "other" }))
      .resolves.toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(mocks.changeStatus).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
