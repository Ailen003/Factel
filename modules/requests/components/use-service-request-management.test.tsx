import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ServiceRequest } from "../lib/types/service-request.types";
import { useServiceRequestManagement } from "./use-service-request-management";

const request: ServiceRequest = {
  id: "request-a",
  client: { id: "client-a", name: "Ana" },
  title: "Router repair",
  description: "Replace the damaged router.",
  serviceType: "repair",
  priority: "high",
  status: "pending",
  preferredSchedule: null,
  serviceAddress: null,
  nextSteps: null,
  version: 2,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
};

describe("service request management state", () => {
  it("selects and clears each independently mounted management surface", () => {
    const { result } = renderHook(() => useServiceRequestManagement());

    act(() => result.current.view(request));
    expect(result.current.viewingRequestId).toBe(request.id);
    act(() => result.current.closeView());
    expect(result.current.viewingRequestId).toBeNull();

    act(() => result.current.edit(request));
    expect(result.current.editingRequestId).toBe(request.id);
    act(() => result.current.closeEdit());
    expect(result.current.editingRequestId).toBeNull();

    act(() => result.current.changeStatus(request, "in_progress"));
    expect(result.current.statusSelection).toEqual({ request, targetStatus: "in_progress" });
    act(() => result.current.closeStatus());
    expect(result.current.statusSelection).toBeNull();

    act(() => result.current.remove(request));
    expect(result.current.deletingRequest).toBe(request);
    act(() => result.current.closeDelete());
    expect(result.current.deletingRequest).toBeNull();
  });
});
