import { act, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { useChangeServiceRequestStatus } from "./use-change-service-request-status";
import { useDeleteServiceRequest } from "./use-delete-service-request";
import { useEditServiceRequest } from "./use-edit-service-request";

const actions = vi.hoisted(() => ({ edit: vi.fn(), changeStatus: vi.fn(), remove: vi.fn() }));
vi.mock("../actions/service-request.actions", () => ({
  editServiceRequestAction: actions.edit,
  changeServiceRequestStatusAction: actions.changeStatus,
  deleteServiceRequestAction: actions.remove,
}));

function wrapper({ children }: PropsWithChildren) {
  return <NextIntlClientProvider locale="en" messages={messages}>{children}</NextIntlClientProvider>;
}

const request = { id: "request-a", client: { id: "client-a", name: "Ana" }, title: "Router",
  description: "Install", serviceType: "installation" as const, priority: "normal" as const,
  status: "pending" as const, preferredSchedule: null, serviceAddress: null, nextSteps: null,
  version: 2, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z" };

describe("service request mutation hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    actions.edit.mockResolvedValue({ success: true, data: request });
    actions.changeStatus.mockResolvedValue({ success: true, data: { ...request, status: "resolved" } });
    actions.remove.mockResolvedValue({ success: true, data: { requestId: request.id } });
  });

  it("returns edited data and passes it to the success callback", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useEditServiceRequest(onSuccess), { wrapper });
    await act(async () => { await result.current.save("request-a", 1, {
      clientId: "client-a", title: "Router", description: "Install", serviceType: "installation", priority: "normal",
    }); });
    expect(result.current.result).toEqual(request);
    expect(onSuccess).toHaveBeenCalledWith(request);
  });

  it("passes status and delete results to their callbacks", async () => {
    const onStatus = vi.fn(); const onDelete = vi.fn();
    const statusHook = renderHook(() => useChangeServiceRequestStatus(onStatus), { wrapper });
    const deleteHook = renderHook(() => useDeleteServiceRequest(onDelete), { wrapper });
    await act(async () => { await statusHook.result.current.changeStatus("request-a", 1, "resolved"); });
    await act(async () => { await deleteHook.result.current.execute("request-a", 2); });
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "resolved" }));
    expect(onDelete).toHaveBeenCalledWith({ requestId: "request-a" });
  });

  it("translates stable service failures and resets local state", async () => {
    actions.changeStatus.mockResolvedValue({ success: false,
      error: { code: "INVALID_STATUS_TRANSITION", message: "INVALID_STATUS_TRANSITION" } });
    const { result } = renderHook(() => useChangeServiceRequestStatus(), { wrapper });
    await act(async () => { await result.current.changeStatus("request-a", 1, "resolved"); });
    expect(result.current.error).toBeTruthy();
    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });
});
