"use client";

import FilterCard from "@/components/filters/filter-card/filter-card";
import useServiceRequestFilters from "./hooks/use-service-request-filters";
import ServiceRequestFiltersPresentational from "./service-request-filters-presentational";
import ServiceRequestActiveFilters from "./service-request-active-filters";

export default function ServiceRequestFiltersContainer() {
  const state = useServiceRequestFilters();
  return <FilterCard activeFilters={state.activeFiltersCount > 0 ? <ServiceRequestActiveFilters {...state} /> : undefined}>
    <ServiceRequestFiltersPresentational filters={state.filters} onChange={state.handleChangeFilters} />
  </FilterCard>;
}
