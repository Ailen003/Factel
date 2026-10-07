"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getClientServiceRequestsAction } from "../actions/service-request.actions";
import type { ServiceRequestFiltersDto, ServiceRequestsResponse } from "../types/service-request.types";

const DEFAULT_FILTERS: ServiceRequestFiltersDto = { page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" };

export function useClientServiceRequests(clientId: string) {
  const t = useTranslations("requests");
  const [filters, setFilters] = useState<ServiceRequestFiltersDto>({ ...DEFAULT_FILTERS, clientId });
  const [data, setData] = useState<ServiceRequestsResponse | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current; setLoading(true); setError(null);
    try { const response = await getClientServiceRequestsAction({ ...filters, clientId });
      if (current !== generation.current) return;
      if (response.success) setData(response.data);
      else { setData(null); setError(t.has(`errors.${response.error.code}` as never) ? t(`errors.${response.error.code}` as never) : t("errors.INTERNAL_ERROR")); }
    } catch { if (current === generation.current) { setData(null); setError(t("errors.INTERNAL_ERROR")); } }
    finally { if (current === generation.current) setLoading(false); }
  }, [clientId, filters, t]);
  useEffect(() => { const activeRequest = generation; const delay = filters.search ? 250 : 0; const timer = window.setTimeout(() => void load(), delay);
    return () => { window.clearTimeout(timer); activeRequest.current++; }; }, [filters, load]);
  const updateFilters = useCallback((patch: Partial<ServiceRequestFiltersDto>) => {
    setFilters((current) => ({ ...current, ...patch, clientId, page: patch.page ?? 1 }));
  }, [clientId]);
  return { filters, data, isLoading, error, updateFilters, refetch: load };
}
