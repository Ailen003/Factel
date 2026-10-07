"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useUrlFilters from "@/hooks/use-url-filters";
import { clientFiltersToDto, DEFAULT_CLIENT_FILTERS, readClientFilters, type ClientFilterState } from "../client-filter-url";

export default function useClientsFilters() {
  const { updateFiltersInUrl } = useUrlFilters({});
  const searchParamsKey = useSearchParams().toString();
  const fromUrl = useMemo(() => readClientFilters(new URLSearchParams(searchParamsKey)), [searchParamsKey]);
  const [pending, setPending] = useState<{ filters: ClientFilterState; key: string } | null>(null);
  // Discard a draft when navigation settles, including Back/Forward to its old URL.
  if (pending && pending.key !== searchParamsKey) setPending(null);
  const filters = pending?.key === searchParamsKey ? pending.filters : fromUrl;
  const handleChangeFilters = useCallback((updates: Partial<ClientFilterState>) => {
    const next = { ...filters, ...updates };
    setPending({ filters: next, key: searchParamsKey });
    updateFiltersInUrl({ ...clientFiltersToDto(next), page: 1 });
  }, [filters, searchParamsKey, updateFiltersInUrl]);
  const handleResetFilters = useCallback(() => {
    setPending({ filters: DEFAULT_CLIENT_FILTERS, key: searchParamsKey });
    updateFiltersInUrl({ ...clientFiltersToDto(DEFAULT_CLIENT_FILTERS), page: 1 });
  }, [searchParamsKey, updateFiltersInUrl]);
  const activeFiltersCount = useMemo(() => Number(Boolean(filters.search)) + Number(filters.sortBy !== "createdAt" || filters.sortOrder !== "desc"), [filters]);
  return { filters, handleChangeFilters, handleResetFilters, activeFiltersCount };
}
