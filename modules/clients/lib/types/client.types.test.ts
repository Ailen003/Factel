import { describe, expect, it } from "vitest";
import { clientFiltersSchema, parseClientFilters, confirmClientCreationSchema } from "./client.types";

describe("client server-boundary contracts", () => {
  it("normalizes hostile URLs without throwing while retaining stricter action validation", () => {
    expect(parseClientFilters({ page: "Infinity", limit: "100000", sortBy: "notes", search: ["x".repeat(200), "other"] }))
      .toEqual({ page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc", search: "x".repeat(100) });
    expect(parseClientFilters({ page: "9007199254740992" }).page).toBe(1);
    expect(clientFiltersSchema.safeParse({ search: "x".repeat(101) }).success).toBe(false);
  });
  it("requires explicit acknowledgment boolean and refuses mutable final payload", () => {
    const input = { planId: "p1", planHash: "a".repeat(64), acknowledgeDuplicates: false };
    expect(confirmClientCreationSchema.safeParse(input).success).toBe(true);
    expect(confirmClientCreationSchema.safeParse({ ...input, client: { name: "tampered" } }).success).toBe(false);
    expect(confirmClientCreationSchema.safeParse({ ...input, acknowledgeDuplicates: "true" }).success).toBe(false);
  });
});
