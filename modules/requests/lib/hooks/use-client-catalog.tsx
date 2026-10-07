"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getClientCatalogAction } from "../actions/service-request.actions";
import type { ClientCatalogOption, ClientCatalogResponse } from "../types/service-request.types";

const PAGE_LIMIT = 25;
const SEARCH_DEBOUNCE_MS = 250;

function mergeOptions(current: ClientCatalogOption[], next: ClientCatalogOption[]) {
  const known = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !known.has(item.id))];
}

export function useClientCatalog(selectedId?: string) {
  const t = useTranslations("requests");
  const [options, setOptions] = useState<ClientCatalogOption[]>([]);
  const [pagination, setPagination] = useState<ClientCatalogResponse["pagination"]>();
  const [search, setSearch] = useState("");
  const [isLoading, setLoading] = useState(true);
  const [isFetchingNextPage, setFetchingNextPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const hasLoaded = useRef(false);

  const loadPage = useCallback(async (page: number, append: boolean) => {
    const current = ++requestId.current;
    if (append) setFetchingNextPage(true);
    else { setLoading(true); setError(null); }
    try {
      const response = await getClientCatalogAction({ page, limit: PAGE_LIMIT, search: search || undefined, selectedId });
      if (current !== requestId.current) return;
      if (!response.success) {
        if (!append) setOptions([]);
        const key = `errors.${response.error.code}`;
        setError(t.has(key as never) ? t(key as never) : t("errors.INTERNAL_ERROR"));
        return;
      }
      setOptions((existing) => append ? mergeOptions(existing, response.data.options) : response.data.options);
      setPagination(response.data.pagination); setError(null); hasLoaded.current = true;
    } catch { if (current === requestId.current) setError(t("errors.INTERNAL_ERROR")); }
    finally { if (current === requestId.current) { setLoading(false); setFetchingNextPage(false); } }
  }, [search, selectedId, t]);

  useEffect(() => {
    const activeRequest = requestId;
    const timeout = window.setTimeout(() => void loadPage(1, false), hasLoaded.current ? SEARCH_DEBOUNCE_MS : 0);
    return () => { window.clearTimeout(timeout); activeRequest.current++; };
  }, [loadPage]);

  const loadNextPage = useCallback(async () => {
    if (!pagination || isLoading || isFetchingNextPage || pagination.page >= pagination.totalPages) return;
    await loadPage(pagination.page + 1, true);
  }, [isFetchingNextPage, isLoading, loadPage, pagination]);

  const reset = useCallback(() => {
    requestId.current++; setOptions([]); setPagination(undefined); setSearch("");
    setLoading(false); setFetchingNextPage(false); setError(null); hasLoaded.current = false;
  }, []);

  return { options, search, setSearch, isLoading, error,
    hasNextPage: Boolean(pagination && pagination.page < pagination.totalPages),
    isFetchingNextPage, loadNextPage, refetch: () => loadPage(1, false), reset };
}
