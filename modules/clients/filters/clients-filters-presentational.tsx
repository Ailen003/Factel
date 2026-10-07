"use client";

import { ArrowDownAZ, ArrowUpZA } from "lucide-react";
import { useTranslations } from "next-intl";
import SearchInput from "@/components/inputs/search-input/search-input";
import SelectInput from "@/components/inputs/select-input/select-input";
import { Button } from "@/components/ui/button";
import type { ClientFilterState } from "./client-filter-url";

export default function ClientsFiltersPresentational({ filters, onChange }: { filters: ClientFilterState; onChange: (update: Partial<ClientFilterState>) => void }) {
  const t = useTranslations("clients");
  const shared = useTranslations("filters");
  return (
    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
      <SearchInput
        id="clients-search"
        label={shared("search")}
        placeHolder={t("searchPlaceholder")}
        value={filters.search}
        onChange={(event) => onChange({ search: event.target.value })}
      />
      <div className="flex items-end gap-2">
        <SelectInput
          label={shared("sortBy")}
          value={filters.sortBy}
          onValueChange={(value) => onChange({ sortBy: value as ClientFilterState["sortBy"] })}
          options={["createdAt", "name", "email", "company"].map((value) => ({ value, label: t(`fields.${value}`) }))}
        />
        <Button
          size="icon"
          variant="outline"
          aria-label={shared(filters.sortOrder === "asc" ? "sortDescending" : "sortAscending")}
          onClick={() => onChange({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })}
        >
          {filters.sortOrder === "asc" ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpZA className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
