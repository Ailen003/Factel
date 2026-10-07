"use client";

import { useTranslations } from "next-intl";
import FilterBadge from "@/components/filters/filter-badge/filter-badge";
import { Button } from "@/components/ui/button";
import type { ServiceRequestFilterState } from "./service-request-filter-url";

export default function ServiceRequestActiveFilters({ filters, activeFiltersCount, handleChangeFilters, handleResetFilters }: {
  filters: ServiceRequestFilterState; activeFiltersCount: number;
  handleChangeFilters: (patch: Partial<ServiceRequestFilterState>) => void; handleResetFilters: () => void;
}) {
  const shared = useTranslations("filters"); const t = useTranslations("requests");
  return <div className="flex flex-wrap items-center gap-2">
    <span className="text-xs text-muted-foreground">{shared("activeFilters", { count: activeFiltersCount })}</span>
    {filters.search && <FilterBadge filterName={shared("search")} filterValue={filters.search} handleDeleteFilter={() => handleChangeFilters({ search: "" })} />}
    {filters.clientId && <FilterBadge filterName={t("fields.client")} filterValue={t("filters.selectedClient")} handleDeleteFilter={() => handleChangeFilters({ clientId: "" })} />}
    {filters.serviceType && <FilterBadge filterName={t("fields.serviceType")} filterValue={t(`serviceTypes.${filters.serviceType}`)} handleDeleteFilter={() => handleChangeFilters({ serviceType: "" })} />}
    {filters.priority && <FilterBadge filterName={t("fields.priority")} filterValue={t(`priorities.${filters.priority}`)} handleDeleteFilter={() => handleChangeFilters({ priority: "" })} />}
    {filters.status && <FilterBadge filterName={t("fields.status")} filterValue={t(`statuses.${filters.status}`)} handleDeleteFilter={() => handleChangeFilters({ status: "" })} />}
    {(filters.sortBy !== "createdAt" || filters.sortOrder !== "desc") && <FilterBadge filterName={shared("sortBy")} filterValue={t(`fields.${filters.sortBy}` as never)} handleDeleteFilter={() => handleChangeFilters({ sortBy: "createdAt", sortOrder: "desc" })} />}
    <Button variant="ghost" size="sm" onClick={handleResetFilters} className="ml-auto">{shared("clearAll")}</Button>
  </div>;
}
