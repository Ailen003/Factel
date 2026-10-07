import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  searchParams: new URLSearchParams("page=3&limit=20"),
  updateFiltersInUrl: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => testState.searchParams,
}));

vi.mock("@/hooks/use-url-filters", () => ({
  default: () => ({ updateFiltersInUrl: testState.updateFiltersInUrl }),
}));

import useUsersFilters from "./use-users-filters";

describe("useUsersFilters", () => {
  beforeEach(() => {
    testState.searchParams = new URLSearchParams("page=3&limit=20");
    testState.updateFiltersInUrl.mockReset();
  });

  it("uses the shared URL updater with the complete filter state and page one", () => {
    const { result } = renderHook(() => useUsersFilters());

    act(() => {
      result.current.handleChangeFilters({
        search: "Alex",
        role: "trial_user",
      });
    });

    expect(result.current.filters).toMatchObject({
      search: "Alex",
      role: "trial_user",
    });
    expect(testState.updateFiltersInUrl).toHaveBeenLastCalledWith({
      search: "Alex",
      role: "trial_user",
      status: undefined,
      sortBy: "createdAt",
      sortOrder: "desc",
      page: 1,
    });
  });

  it("restores its state when browser navigation changes the URL", () => {
    const { result, rerender } = renderHook(() => useUsersFilters());

    act(() => {
      result.current.handleChangeFilters({ search: "stale" });
    });
    testState.searchParams = new URLSearchParams(
      "search=Maria&status=suspended&sortBy=email&sortOrder=asc",
    );
    rerender();

    expect(result.current.filters).toEqual({
      search: "Maria",
      role: "",
      status: "suspended",
      sortBy: "email",
      sortOrder: "asc",
    });
  });

  it("clears only optional filter values and restores default sorting on reset", () => {
    testState.searchParams = new URLSearchParams(
      "search=Alex&role=trial_user&status=active&sortBy=email&sortOrder=asc",
    );
    const { result } = renderHook(() => useUsersFilters());

    act(() => {
      result.current.handleResetFilters();
    });

    expect(testState.updateFiltersInUrl).toHaveBeenCalledWith({
      search: undefined,
      role: undefined,
      status: undefined,
      sortBy: "createdAt",
      sortOrder: "desc",
      page: 1,
    });
  });
});
