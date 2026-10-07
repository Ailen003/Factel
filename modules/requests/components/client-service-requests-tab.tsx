"use client";

import { CheckCircle2, CircleDot, ListChecks, PlayCircle, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import SearchInput from "@/components/inputs/search-input/search-input";
import SelectInput from "@/components/inputs/select-input/select-input";
import { Button } from "@/components/ui/button";
import { AlertComponent } from "@/components/ui/alert-component";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { REQUEST_PRIORITIES, REQUEST_STATUSES, SERVICE_TYPES } from "../form/create/schemas/create-service-request-schema";
import { useClientServiceRequests } from "../lib/hooks/use-client-service-requests";
import ServiceRequestListTableView from "../list/service-request-list-table-view";
import ServiceRequestListCardsView from "../list/service-request-list-cards-view";
import ServiceRequestManagementDialogs from "./service-request-management-dialogs";
import { useServiceRequestManagement } from "./use-service-request-management";

export default function ClientServiceRequestsTab({ clientId }: { clientId: string }) {
  const t = useTranslations("requests"); const shared = useTranslations("filters");
  const state = useClientServiceRequests(clientId);
  const management = useServiceRequestManagement();
  if (state.isLoading && !state.data) return <div className="space-y-3 py-4"><Skeleton className="h-20 w-full" />
    {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>;
  if (state.error && !state.data) return <div className="space-y-3 py-4"><AlertComponent variant="destructive" title={state.error} />
    <Button variant="outline" onClick={() => void state.refetch()}>{t("retry")}</Button></div>;
  const data = state.data;
  if (!data) return null;
  const summary = data.summary ?? { total: 0, pending: 0, in_progress: 0, resolved: 0, cancelled: 0 };
  const cards = [
    { key: "total", value: summary.total, icon: ListChecks }, { key: "pending", value: summary.pending, icon: CircleDot },
    { key: "in_progress", value: summary.in_progress, icon: PlayCircle }, { key: "resolved", value: summary.resolved, icon: CheckCircle2 },
    { key: "cancelled", value: summary.cancelled, icon: XCircle },
  ] as const;
  return <div className="space-y-5 py-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{cards.map((card) => <StatCard key={card.key}
      title={t(`summary.${card.key}`)} value={card.value} icon={card.icon} className="h-full" />)}</div>
    <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
      <SearchInput id={`client-${clientId}-requests-search`} label={shared("search")} placeHolder={t("searchPlaceholder")}
        value={state.filters.search} onChange={(event) => state.updateFilters({ search: event.target.value || undefined })} />
      <SelectInput label={t("fields.serviceType")} placeholder={t("filters.allServiceTypes")} value={state.filters.serviceType}
        onValueChange={(value) => state.updateFilters({ serviceType: value as typeof state.filters.serviceType })}
        options={SERVICE_TYPES.map((value) => ({ value, label: t(`serviceTypes.${value}`) }))}
        clearable={state.filters.serviceType ? { handleClear: () => state.updateFilters({ serviceType: undefined }) } : undefined} />
      <SelectInput label={t("fields.priority")} placeholder={t("filters.allPriorities")} value={state.filters.priority}
        onValueChange={(value) => state.updateFilters({ priority: value as typeof state.filters.priority })}
        options={REQUEST_PRIORITIES.map((value) => ({ value, label: t(`priorities.${value}`) }))}
        clearable={state.filters.priority ? { handleClear: () => state.updateFilters({ priority: undefined }) } : undefined} />
      <SelectInput label={t("fields.status")} placeholder={t("filters.allStatuses")} value={state.filters.status}
        onValueChange={(value) => state.updateFilters({ status: value as typeof state.filters.status })}
        options={REQUEST_STATUSES.map((value) => ({ value, label: t(`statuses.${value}`) }))}
        clearable={state.filters.status ? { handleClear: () => state.updateFilters({ status: undefined }) } : undefined} />
    </div>
    {state.error && <AlertComponent variant="destructive" title={state.error} />}
    <div className={state.isLoading ? "pointer-events-none opacity-60" : ""} aria-busy={state.isLoading}>
      <div className="hidden md:block"><ServiceRequestListTableView requests={data.requests} embedded
        onView={management.view} onEdit={management.edit} onChangeStatus={management.changeStatus} onDelete={management.remove} /></div>
      <div className="block md:hidden"><ServiceRequestListCardsView requests={data.requests} embedded
        onView={management.view} onEdit={management.edit} onChangeStatus={management.changeStatus} onDelete={management.remove} /></div>
    </div>
    <div className="flex flex-col gap-3 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">{t("pagination.showing", { start: data.pagination.total ? (data.pagination.page - 1) * data.pagination.limit + 1 : 0,
        end: Math.min(data.pagination.page * data.pagination.limit, data.pagination.total), total: data.pagination.total })}</p>
      <div className="flex items-center gap-2">
        <SelectInput fullWidth={false} value={String(data.pagination.limit)} onValueChange={(value) => state.updateFilters({ limit: Number(value) })}
          options={[5, 10, 20].map((value) => ({ value: String(value), label: String(value) }))} />
        <Button size="sm" variant="outline" disabled={data.pagination.page <= 1 || state.isLoading}
          onClick={() => state.updateFilters({ page: data.pagination.page - 1 })}>{t("pagination.previous")}</Button>
        <span className="min-w-16 text-center tabular-nums">{data.pagination.page}/{data.pagination.totalPages}</span>
        <Button size="sm" variant="outline" disabled={data.pagination.page >= data.pagination.totalPages || state.isLoading}
          onClick={() => state.updateFilters({ page: data.pagination.page + 1 })}>{t("pagination.next")}</Button>
      </div>
    </div>
    <ServiceRequestManagementDialogs management={management} onMutated={() => void state.refetch()} />
  </div>;
}
