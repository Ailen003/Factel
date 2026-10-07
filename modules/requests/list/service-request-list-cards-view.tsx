"use client";

import { useTranslations } from "next-intl";
import { CardViewWrapper } from "@/components/ui/card-view-wrapper";
import type { ServiceRequest, ServiceRequestStatus } from "../lib/types/service-request.types";
import ServiceRequestActionsMenu from "../components/service-request-actions-menu";

export default function ServiceRequestListCardsView({ requests, onView, onEdit, onChangeStatus, onDelete, embedded = false }: {
  requests: ServiceRequest[];
  onView: (request: ServiceRequest) => void;
  onEdit: (request: ServiceRequest) => void;
  onChangeStatus: (request: ServiceRequest, targetStatus: ServiceRequestStatus) => void;
  onDelete: (request: ServiceRequest) => void;
  embedded?: boolean;
}) {
  const t = useTranslations("requests");
  return <CardViewWrapper headerConfig={embedded ? undefined : { title: t("title") }}>
    {requests.length === 0 ? <p className="rounded-lg border p-6 text-center text-muted-foreground">{t("empty")}</p> :
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{requests.map((request) => <article key={request.id} className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-2"><h3 className="break-words font-semibold">{request.title}</h3>
          <ServiceRequestActionsMenu request={request} onView={onView} onEdit={onEdit}
            onChangeStatus={onChangeStatus} onDelete={onDelete} /></div>
        <p className="mt-1 text-sm text-muted-foreground">{request.client.name}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">{(["serviceType", "priority", "status"] as const).map((field) => <div key={field}>
          <dt className="text-xs text-muted-foreground">{t(`fields.${field}`)}</dt>
          <dd>{t(`${field === "serviceType" ? "serviceTypes" : field === "priority" ? "priorities" : "statuses"}.${request[field]}` as never)}</dd>
        </div>)}</dl>
      </article>)}</div>}
  </CardViewWrapper>;
}
