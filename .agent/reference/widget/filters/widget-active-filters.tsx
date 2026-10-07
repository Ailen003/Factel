"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { WidgetFilters } from "../lib/types/widget.types";

interface Props {
  filters: WidgetFilters;
  activeFiltersCount: number;
  handleChangeFilters: (newFilters: Partial<WidgetFilters>) => void;
  handleResetFilters: () => void;
}

export default function WidgetActiveFilters({ filters, activeFiltersCount, handleChangeFilters, handleResetFilters }: Props) {
  const t = useTranslations("filters");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{t("activeFilters", { count: activeFiltersCount })}:</span>
      {filters.search && (
        <Badge variant="secondary" className="gap-1">
          {t("search")}: {filters.search}
          <button onClick={() => handleChangeFilters({ search: "" })}><X className="h-3 w-3" /></button>
        </Badge>
      )}
      {filters.isActive !== "" && (
        <Badge variant="secondary" className="gap-1">
          {filters.isActive ? t("active") : t("inactive")}
          <button onClick={() => handleChangeFilters({ isActive: "" })}><X className="h-3 w-3" /></button>
        </Badge>
      )}
      {filters.createdBy && (
        <Badge variant="secondary" className="gap-1">
          {t("user")}: {filters.createdBy}
          <button onClick={() => handleChangeFilters({ createdBy: "" })}><X className="h-3 w-3" /></button>
        </Badge>
      )}
      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleResetFilters}>
        {t("clearAll")}
      </Button>
    </div>
  );
}
