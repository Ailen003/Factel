"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useUrlFilters from "@/hooks/use-url-filters";
import { conversationFiltersToDto, DEFAULT_CONVERSATION_FILTERS, readConversationFilters, type ConversationFilterState } from "../conversation-filter-url";

export default function useConversationsFilters() {
  const { updateFiltersInUrl } = useUrlFilters({});
  const searchParamsKey = useSearchParams().toString();
  const fromUrl = useMemo(() => readConversationFilters(new URLSearchParams(searchParamsKey)), [searchParamsKey]);
  const [pending, setPending] = useState<{ filters: ConversationFilterState; key: string } | null>(null);
  if (pending && pending.key !== searchParamsKey) setPending(null);
  const filters = pending?.key === searchParamsKey ? pending.filters : fromUrl;
  const handleChangeFilters = useCallback((updates: Partial<ConversationFilterState>) => {
    const next = { ...filters, ...updates };
    setPending({ filters: next, key: searchParamsKey });
    updateFiltersInUrl({ ...conversationFiltersToDto(next), page: 1 });
  }, [filters, searchParamsKey, updateFiltersInUrl]);
  const handleResetFilters = useCallback(() => {
    setPending({ filters: DEFAULT_CONVERSATION_FILTERS, key: searchParamsKey });
    updateFiltersInUrl({ ...conversationFiltersToDto(DEFAULT_CONVERSATION_FILTERS), page: 1 });
  }, [searchParamsKey, updateFiltersInUrl]);
  const activeFiltersCount = useMemo(() => Number(Boolean(filters.sourceType)) + Number(Boolean(filters.locale))
    + Number(Boolean(filters.status)) + Number(filters.sortBy !== "createdAt" || filters.sortOrder !== "desc"), [filters]);
  return { filters, handleChangeFilters, handleResetFilters, activeFiltersCount };
}
