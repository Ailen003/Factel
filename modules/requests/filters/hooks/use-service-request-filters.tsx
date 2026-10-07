"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useUrlFilters from "@/hooks/use-url-filters";
import { DEFAULT_SERVICE_REQUEST_FILTERS, readServiceRequestFilters, serviceRequestFiltersToDto, type ServiceRequestFilterState } from "../service-request-filter-url";

export default function useServiceRequestFilters() {
  const { updateFiltersInUrl } = useUrlFilters({ scroll: false });
  const searchParamsKey = useSearchParams().toString();
  const fromUrl = useMemo(() => readServiceRequestFilters(new URLSearchParams(searchParamsKey)), [searchParamsKey]);
  const [pending, setPending] = useState<{ filters: ServiceRequestFilterState; key: string } | null>(null);
  if (pending && pending.key !== searchParamsKey) setPending(null);
  const filters = pending?.key === searchParamsKey ? pending.filters : fromUrl;
  const activeFiltersCount = useMemo(() => [filters.search, filters.clientId, filters.serviceType, filters.priority, filters.status,
    filters.sortBy !== "createdAt" || filters.sortOrder !== "desc" ? "sort" : ""].filter(Boolean).length, [filters]);
  const handleChangeFilters = useCallback((patch: Partial<ServiceRequestFilterState>) => {
    const next = { ...filters, ...patch };
    setPending({ filters: next, key: searchParamsKey });
    updateFiltersInUrl({ ...serviceRequestFiltersToDto(next), page: 1 });
  }, [filters, searchParamsKey, updateFiltersInUrl]);
  const handleResetFilters = useCallback(() => { setPending({ filters: DEFAULT_SERVICE_REQUEST_FILTERS, key: searchParamsKey });
    updateFiltersInUrl({ search: undefined, clientId: undefined, serviceType: undefined, priority: undefined,
      status: undefined, sortBy: undefined, sortOrder: undefined, page: 1 }); }, [searchParamsKey, updateFiltersInUrl]);
  return { filters, activeFiltersCount, handleChangeFilters, handleResetFilters };
}
