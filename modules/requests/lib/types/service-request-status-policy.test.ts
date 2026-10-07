import { describe, expect, it } from "vitest";
import { canTransitionServiceRequestStatus, getAllowedServiceRequestStatuses } from "./service-request-status-policy";

describe("service request status transition policy", () => {
  it("allows active requests to advance, cancel or return to pending", () => {
    expect(getAllowedServiceRequestStatuses("pending")).toEqual(["in_progress", "resolved", "cancelled"]);
    expect(getAllowedServiceRequestStatuses("in_progress")).toEqual(["pending", "resolved", "cancelled"]);
  });

  it("reopens terminal requests only to pending", () => {
    expect(getAllowedServiceRequestStatuses("resolved")).toEqual(["pending"]);
    expect(getAllowedServiceRequestStatuses("cancelled")).toEqual(["pending"]);
    expect(canTransitionServiceRequestStatus("resolved", "in_progress")).toBe(false);
  });

  it("rejects no-op transitions", () => {
    expect(canTransitionServiceRequestStatus("pending", "pending")).toBe(false);
    expect(canTransitionServiceRequestStatus("cancelled", "cancelled")).toBe(false);
  });
});
