"use client";

import FilterCard from "@/components/filters/filter-card/filter-card";
import useClientsFilters from "./hooks/use-clients-filters";
import ClientsFiltersPresentational from "./clients-filters-presentational";
import ClientsActiveFilters from "./clients-active-filters";

export default function ClientsFiltersContainer() {
  const state = useClientsFilters();
  return <FilterCard activeFilters={state.activeFiltersCount > 0 ? <ClientsActiveFilters {...state} /> : undefined}>
    <ClientsFiltersPresentational filters={state.filters} onChange={state.handleChangeFilters} />
  </FilterCard>;
}
