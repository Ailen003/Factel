import { describe, expect, it } from "vitest";
import {
  changeServiceRequestStatusInputSchema, deleteServiceRequestInputSchema,
  editServiceRequestInputSchema, parseServiceRequestFilters,
} from "./service-request.types";

describe("service request filter parsing", () => {
  it("parses supported filters and clamps invalid values to safe defaults", () => {
    expect(parseServiceRequestFilters({ page: "2", limit: "20", clientId: "client-a", status: "pending", sortBy: "title", sortOrder: "asc" }))
      .toMatchObject({ page: 2, limit: 20, clientId: "client-a", status: "pending", sortBy: "title", sortOrder: "asc" });
    expect(parseServiceRequestFilters({ page: "0", limit: "999", status: "unknown", sortBy: "client" }))
      .toEqual({ page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" });
  });

  it("bounds search and ignores duplicate query-array values after the first", () => {
    const result = parseServiceRequestFilters({ search: [" router ", "ignored"], page: ["3", "8"] });
    expect(result).toMatchObject({ search: "router", page: 3 });
  });

  it("keeps lifecycle mutation inputs strict and versioned", () => {
    const request = { clientId: "client-a", title: "Router", description: "Install",
      serviceType: "installation", priority: "normal" };
    expect(editServiceRequestInputSchema.safeParse({ id: "request-a", expectedVersion: 1, request }).success).toBe(true);
    expect(editServiceRequestInputSchema.safeParse({ id: "request-a", expectedVersion: 1,
      request: { ...request, status: "resolved" } }).success).toBe(false);
    expect(changeServiceRequestStatusInputSchema.safeParse({ id: "request-a", expectedVersion: 1,
      status: "resolved", workspaceId: "workspace-a" }).success).toBe(false);
    expect(deleteServiceRequestInputSchema.safeParse({ id: "request-a", expectedVersion: 0 }).success).toBe(false);
  });
});
