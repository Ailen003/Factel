"use client";

import { ArrowDownAZ, ArrowUpZA } from "lucide-react";
import { useTranslations } from "next-intl";
import SearchInput from "@/components/inputs/search-input/search-input";
import SelectInput from "@/components/inputs/select-input/select-input";
import { Button } from "@/components/ui/button";
import { useClientCatalog } from "../lib/hooks/use-client-catalog";
import { REQUEST_PRIORITIES, REQUEST_STATUSES, SERVICE_TYPES } from "../form/create/schemas/create-service-request-schema";
import type { ServiceRequestFilterState } from "./service-request-filter-url";

export default function ServiceRequestFiltersPresentational({ filters, onChange }: {
  filters: ServiceRequestFilterState; onChange: (patch: Partial<ServiceRequestFilterState>) => void;
}) {
  const t = useTranslations("requests"); const shared = useTranslations("filters"); const clients = useClientCatalog(filters.clientId || undefined);
  return <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
    <SearchInput id="requests-search" label={shared("search")} placeHolder={t("searchPlaceholder")}
      value={filters.search} onChange={(event) => onChange({ search: event.target.value })} />
    <SelectInput label={t("fields.client")} placeholder={t("filters.allClients")} value={filters.clientId || undefined}
      onValueChange={(value) => onChange({ clientId: value })} options={clients.options.map((item) => ({ value: item.id, label: item.label }))}
      loading={clients.isLoading} emptyText={clients.error ?? t("filters.noClients")} filterValue={clients.search}
      onFilterChange={clients.setSearch} filterPlaceholder={t("filters.searchClients")}
      hasNextPage={clients.hasNextPage} isFetchingNextPage={clients.isFetchingNextPage}
      onLoadNextPage={() => void clients.loadNextPage()} clearable={filters.clientId ? { handleClear: () => onChange({ clientId: "" }) } : undefined} />
    <SelectInput label={t("fields.serviceType")} placeholder={t("filters.allServiceTypes")} value={filters.serviceType || undefined}
      onValueChange={(value) => onChange({ serviceType: value as ServiceRequestFilterState["serviceType"] })}
      options={SERVICE_TYPES.map((value) => ({ value, label: t(`serviceTypes.${value}`) }))}
      clearable={filters.serviceType ? { handleClear: () => onChange({ serviceType: "" }) } : undefined} />
    <SelectInput label={t("fields.priority")} placeholder={t("filters.allPriorities")} value={filters.priority || undefined}
      onValueChange={(value) => onChange({ priority: value as ServiceRequestFilterState["priority"] })}
      options={REQUEST_PRIORITIES.map((value) => ({ value, label: t(`priorities.${value}`) }))}
      clearable={filters.priority ? { handleClear: () => onChange({ priority: "" }) } : undefined} />
    <SelectInput label={t("fields.status")} placeholder={t("filters.allStatuses")} value={filters.status || undefined}
      onValueChange={(value) => onChange({ status: value as ServiceRequestFilterState["status"] })}
      options={REQUEST_STATUSES.map((value) => ({ value, label: t(`statuses.${value}`) }))}
      clearable={filters.status ? { handleClear: () => onChange({ status: "" }) } : undefined} />
    <div className="flex items-end gap-2 xl:col-span-2">
      <SelectInput label={shared("sortBy")} value={filters.sortBy}
        onValueChange={(value) => onChange({ sortBy: value as ServiceRequestFilterState["sortBy"] })}
        options={["createdAt", "updatedAt", "title", "priority", "status"].map((value) => ({ value, label: t(`fields.${value}` as never) }))} />
      <Button size="icon" variant="outline" aria-label={shared(filters.sortOrder === "asc" ? "sortDescending" : "sortAscending")}
        onClick={() => onChange({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })}>
        {filters.sortOrder === "asc" ? <ArrowDownAZ /> : <ArrowUpZA />}
      </Button>
    </div>
  </div>;
}
