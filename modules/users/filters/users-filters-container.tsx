"use client";
import useUsersFilters from "./hooks/use-users-filters";
import UsersFiltersPresentational from "./users-filters-presentational";
import UsersActiveFilters from "./users-active-filters";
import FilterCard from "@/components/filters/filter-card/filter-card";

export default function UsersFiltersContainer() {
  const {
    filters,
    handleChangeFilters,
    getActiveFiltersCount,
    handleResetFilters,
  } = useUsersFilters();

  const activeFiltersCount = getActiveFiltersCount;

  return (
    <FilterCard
      activeFilters={activeFiltersCount > 0 ? (
        <UsersActiveFilters
          filters={filters}
          activeFiltersCount={activeFiltersCount}
          handleChangeFilters={handleChangeFilters}
          handleResetFilters={handleResetFilters}
        />
      ) : undefined}
    >
      <UsersFiltersPresentational
        filters={filters}
        handleChangeFilters={handleChangeFilters}
      />
    </FilterCard>
  );
}
