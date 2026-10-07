"use client";

import { useTranslations } from "next-intl";
import FilterBadge from "@/components/filters/filter-badge/filter-badge";
import { Button } from "@/components/ui/button";
import type { ConversationFilterState } from "./conversation-filter-url";

export default function ConversationsActiveFilters({ filters, activeFiltersCount, handleChangeFilters, handleResetFilters }: {
  filters: ConversationFilterState; activeFiltersCount: number;
  handleChangeFilters: (update: Partial<ConversationFilterState>) => void; handleResetFilters: () => void;
}) {
  const shared = useTranslations("filters");
  const t = useTranslations("conversations");
  return <div className="flex flex-wrap items-center gap-2">
    <span className="text-xs text-muted-foreground">{shared("activeFilters", { count: activeFiltersCount })}</span>
    {filters.sourceType && <FilterBadge filterName={t("fields.source")} filterValue={t(`sources.${filters.sourceType}`)} handleDeleteFilter={() => handleChangeFilters({ sourceType: "" })} />}
    {filters.locale && <FilterBadge filterName={t("fields.locale")} filterValue={t(`locales.${filters.locale}`)} handleDeleteFilter={() => handleChangeFilters({ locale: "" })} />}
    {filters.status && <FilterBadge filterName={shared("status")} filterValue={t(`statuses.${filters.status}`)} handleDeleteFilter={() => handleChangeFilters({ status: "" })} />}
    {(filters.sortBy !== "createdAt" || filters.sortOrder !== "desc") && <FilterBadge filterName={shared("sortBy")} filterValue={t(`fields.${filters.sortBy}`)} handleDeleteFilter={() => handleChangeFilters({ sortBy: "createdAt", sortOrder: "desc" })} />}
    <Button variant="ghost" size="sm" onClick={handleResetFilters} className="ml-auto">{shared("clearAll")}</Button>
  </div>;
}
