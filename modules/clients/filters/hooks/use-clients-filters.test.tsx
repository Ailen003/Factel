import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import ModulePagination from "@/components/pagination/module-pagination";
import useClientsFilters from "./use-clients-filters";

const navigation = vi.hoisted(() => ({
  params: new URLSearchParams("page=3&limit=20"), replace: vi.fn(), push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.params,
  usePathname: () => "/en/clients",
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
}));

describe("Clients URL state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigation.params = new URLSearchParams("page=3&limit=20");
  });
  afterEach(() => vi.useRealTimers());

  it("debounces typing and resets page while retaining the selected page size", () => {
    const { result } = renderHook(() => useClientsFilters());
    act(() => result.current.handleChangeFilters({ search: "A" }));
    act(() => result.current.handleChangeFilters({ search: "Ana" }));
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(result.current.filters.search).toBe("Ana");
    act(() => vi.advanceTimersByTime(300));
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith("/en/clients?page=1&limit=20&search=Ana&sortBy=createdAt&sortOrder=desc", { scroll: false });
  });

  it("restores filters across Back/Forward without resurrecting an earlier pending draft", () => {
    const { result, rerender } = renderHook(() => useClientsFilters());
    act(() => result.current.handleChangeFilters({ search: "unsaved" }));
    navigation.params = new URLSearchParams("page=2&limit=20&search=Maria&sortBy=name&sortOrder=asc");
    rerender();
    expect(result.current.filters).toEqual({ search: "Maria", sortBy: "name", sortOrder: "asc" });
    act(() => vi.advanceTimersByTime(300));
    expect(navigation.replace).not.toHaveBeenCalled();
    navigation.params = new URLSearchParams("page=3&limit=20");
    rerender();
    expect(result.current.filters.search).toBe("");
    navigation.params = new URLSearchParams("page=2&limit=20&search=Maria&sortBy=name&sortOrder=asc");
    rerender();
    expect(result.current.filters.search).toBe("Maria");
  });

  it("reset cancels pending search and clears sorting with page one", () => {
    navigation.params = new URLSearchParams("page=3&limit=5&search=Ana&sortBy=name&sortOrder=asc");
    const { result } = renderHook(() => useClientsFilters());
    expect(result.current.activeFiltersCount).toBe(2);
    act(() => result.current.handleChangeFilters({ search: "Another" }));
    act(() => result.current.handleResetFilters());
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.activeFiltersCount).toBe(0);
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith("/en/clients?page=1&limit=5&sortBy=createdAt&sortOrder=desc", { scroll: false });
  });

  it("does not navigate after unmount", () => {
    const { result, unmount } = renderHook(() => useClientsFilters());
    act(() => result.current.handleChangeFilters({ search: "pending" }));
    unmount();
    act(() => vi.advanceTimersByTime(300));
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("shared pagination keeps current search and sorting", () => {
    navigation.params = new URLSearchParams("page=2&limit=20&search=Ana&sortBy=name&sortOrder=asc");
    render(<NextIntlClientProvider locale="en" messages={messages}><ModulePagination pagination={{ page: 2, limit: 20, total: 60, totalPages: 3 }} limitOptions={[5, 10, 20, 30]} /></NextIntlClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: messages.pagination.nextPage }));
    expect(navigation.push).toHaveBeenCalledWith("/en/clients?page=3&limit=20&search=Ana&sortBy=name&sortOrder=asc", { scroll: false });
  });
});
