"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getWidgetUsersForSelectAction } from "../actions/widget.actions";
import type { WidgetUserOption, WidgetsResponse } from "../types/widget.types";

const PAGE_LIMIT = 25;
const SEARCH_DEBOUNCE_MS = 250;

export function useWidgetUsersForSelect() {
  const t = useTranslations("widgets");
  const [users, setUsers] = useState<WidgetUserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");
  const [pagination, setPagination] = useState<WidgetsResponse["pagination"]>();
  const requestIdRef = useRef(0);

  const fetchUsers = useCallback(async (page = 1, append = false) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (append) setIsFetchingNextPage(true);
    else {
      setIsLoading(true);
      setError(null);
    }

    try {
      const response = await getWidgetUsersForSelectAction({
        page,
        limit: PAGE_LIMIT,
        search: filterValue || undefined,
      });
      if (requestIdRef.current !== requestId) return;
      if (!response.success) {
        const code = response.error.code as string;
        if (!append) setUsers([]);
        setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : response.error.message);
        return;
      }

      setUsers((current) => {
        if (!append) return response.data.users;
        const knownIds = new Set(current.map((user) => user.id));
        return [...current, ...response.data.users.filter((user) => !knownIds.has(user.id))];
      });
      setPagination(response.data.pagination);
      setError(null);
    } catch (cause) {
      if (requestIdRef.current !== requestId) return;
      if (!append) setUsers([]);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
        setIsFetchingNextPage(false);
      }
    }
  }, [filterValue, t]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchUsers(), SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timeoutId);
      requestIdRef.current += 1;
    };
  }, [fetchUsers]);

  const loadNextPage = useCallback(async () => {
    if (!pagination || isLoading || isFetchingNextPage || pagination.page >= pagination.totalPages) return;
    await fetchUsers(pagination.page + 1, true);
  }, [fetchUsers, isFetchingNextPage, isLoading, pagination]);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    setUsers([]);
    setError(null);
    setIsLoading(false);
    setIsFetchingNextPage(false);
    setPagination(undefined);
  }, []);

  return {
    users,
    isLoading,
    isFetchingNextPage,
    error,
    filterValue,
    setFilterValue,
    hasNextPage: Boolean(pagination && pagination.page < pagination.totalPages),
    loadNextPage,
    refetch: fetchUsers,
    reset,
  };
}
