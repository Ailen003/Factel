"use client";

import useWidgetFilters from "./hooks/use-widget-filters";
import WidgetFiltersPresentational from "./widget-filters-presentational";
import WidgetActiveFilters from "./widget-active-filters";
import FilterCard from "@/components/filters/filter-card/filter-card";

export default function WidgetFiltersContainer() {
  const { filters, handleChangeFilters, getActiveFiltersCount, handleResetFilters } = useWidgetFilters({});
  const activeFiltersCount = getActiveFiltersCount;

  return (
    <FilterCard
      activeFilters={activeFiltersCount > 0 ? (
        <WidgetActiveFilters
          filters={filters}
          activeFiltersCount={activeFiltersCount}
          handleChangeFilters={handleChangeFilters}
          handleResetFilters={handleResetFilters}
        />
      ) : undefined}
    >
      <WidgetFiltersPresentational filters={filters} handleChangeFilters={handleChangeFilters} />
    </FilterCard>
  );
}
