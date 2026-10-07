"use client";

import { useTranslations } from "next-intl";
import FilterBadge from "@/components/filters/filter-badge/filter-badge";
import { Button } from "@/components/ui/button";
import type { ClientFilterState } from "./client-filter-url";

export default function ClientsActiveFilters({ filters, activeFiltersCount, handleChangeFilters, handleResetFilters }: {
  filters: ClientFilterState; activeFiltersCount: number;
  handleChangeFilters: (update: Partial<ClientFilterState>) => void; handleResetFilters: () => void;
}) {
  const t = useTranslations("filters");
  const clients = useTranslations("clients");
  return <div className="flex flex-wrap items-center gap-2">
    <span className="text-xs text-muted-foreground">{t("activeFilters", { count: activeFiltersCount })}</span>
    {filters.search && <FilterBadge filterName={t("search")} filterValue={filters.search} handleDeleteFilter={() => handleChangeFilters({ search: "" })} />}
    {(filters.sortBy !== "createdAt" || filters.sortOrder !== "desc") && <FilterBadge filterName={t("sortBy")} filterValue={clients(`fields.${filters.sortBy}`)} handleDeleteFilter={() => handleChangeFilters({ sortBy: "createdAt", sortOrder: "desc" })} />}
    <Button variant="ghost" size="sm" onClick={handleResetFilters} className="ml-auto">{t("clearAll")}</Button>
  </div>;
}
