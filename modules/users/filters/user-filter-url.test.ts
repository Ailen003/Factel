import { describe, expect, it } from "vitest";
import { DEFAULT_USER_FILTERS, readUserFilters, writeUserFilters } from "./user-filter-url";

describe("user URL filters", () => {
  it("reads supported values and ignores altered values", () => {
    expect(readUserFilters(new URLSearchParams("role=trial_user&status=active&sortBy=email&sortOrder=asc"))).toMatchObject({
      role: "trial_user",
      status: "active",
      sortBy: "email",
      sortOrder: "asc",
    });
    expect(readUserFilters(new URLSearchParams("role=owner&status=deleted"))).toEqual(DEFAULT_USER_FILTERS);
  });

  it("preserves unrelated pagination limit and resets page", () => {
    const next = writeUserFilters(
      new URLSearchParams("page=4&limit=20"),
      { ...DEFAULT_USER_FILTERS, search: "alex", role: "trial_user" },
    );
    expect(next.get("page")).toBe("1");
    expect(next.get("limit")).toBe("20");
    expect(next.get("search")).toBe("alex");
  });
});
