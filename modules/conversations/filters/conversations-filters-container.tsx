"use client";

import FilterCard from "@/components/filters/filter-card/filter-card";
import ConversationsActiveFilters from "./conversations-active-filters";
import ConversationsFiltersPresentational from "./conversations-filters-presentational";
import useConversationsFilters from "./hooks/use-conversations-filters";

export default function ConversationsFiltersContainer() {
  const state = useConversationsFilters();
  return <FilterCard activeFilters={state.activeFiltersCount > 0 ? <ConversationsActiveFilters {...state} /> : undefined}>
    <ConversationsFiltersPresentational filters={state.filters} onChange={state.handleChangeFilters} />
  </FilterCard>;
}
