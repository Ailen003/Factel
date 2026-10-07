"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useUrlFilters from "@/hooks/use-url-filters";
import {
  DEFAULT_USER_FILTERS,
  readUserFilters,
  userFiltersToDto,
  type UserFilterState,
} from "../user-filter-url";

export type UserFilters = UserFilterState;

export default function useUsersFilters() {
  const { updateFiltersInUrl } = useUrlFilters({});
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const filtersFromUrl = useMemo(
    () => readUserFilters(new URLSearchParams(searchParamsKey)),
    [searchParamsKey],
  );
  const [pendingFilters, setPendingFilters] = useState<{
    filters: UserFilters;
    searchParamsKey: string;
  } | null>(null);
  const filters =
    pendingFilters?.searchParamsKey === searchParamsKey
      ? pendingFilters.filters
      : filtersFromUrl;

  const handleChangeFilters = useCallback(
    (updates: Partial<UserFilters>) => {
      const next = { ...filters, ...updates };
      setPendingFilters({ filters: next, searchParamsKey });
      updateFiltersInUrl({ ...userFiltersToDto(next), page: 1 });
    },
    [filters, searchParamsKey, updateFiltersInUrl],
  );

  const handleResetFilters = useCallback(() => {
    setPendingFilters({ filters: DEFAULT_USER_FILTERS, searchParamsKey });
    updateFiltersInUrl({ ...userFiltersToDto(DEFAULT_USER_FILTERS), page: 1 });
  }, [searchParamsKey, updateFiltersInUrl]);

  const getActiveFiltersCount = useMemo(
    () => Number(Boolean(filters.search)) + Number(Boolean(filters.role)) + Number(Boolean(filters.status)),
    [filters.role, filters.search, filters.status],
  );

  return { filters, handleChangeFilters, handleResetFilters, getActiveFiltersCount };
}
