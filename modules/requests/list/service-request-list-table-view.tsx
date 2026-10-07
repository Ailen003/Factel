"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useFormatter, useTranslations } from "next-intl";
import { ListChecks } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import type { ServiceRequest, ServiceRequestStatus } from "../lib/types/service-request.types";
import ServiceRequestActionsMenu from "../components/service-request-actions-menu";

export default function ServiceRequestListTableView({ requests, onView, onEdit, onChangeStatus, onDelete, embedded = false }: {
  requests: ServiceRequest[];
  onView: (request: ServiceRequest) => void;
  onEdit: (request: ServiceRequest) => void;
  onChangeStatus: (request: ServiceRequest, targetStatus: ServiceRequestStatus) => void;
  onDelete: (request: ServiceRequest) => void;
  embedded?: boolean;
}) {
  const t = useTranslations("requests"); const format = useFormatter();
  const columns: ColumnDef<ServiceRequest>[] = [
    { accessorKey: "title", header: t("fields.title"), cell: ({ row }) => <span className="font-medium">{row.original.title}</span> },
    { id: "client", header: t("fields.client"), cell: ({ row }) => row.original.client.name },
    { accessorKey: "serviceType", header: t("fields.serviceType"), cell: ({ row }) => t(`serviceTypes.${row.original.serviceType}`) },
    { accessorKey: "priority", header: t("fields.priority"), cell: ({ row }) => t(`priorities.${row.original.priority}`) },
    { accessorKey: "status", header: t("fields.status"), cell: ({ row }) => t(`statuses.${row.original.status}`) },
    { accessorKey: "createdAt", header: t("fields.createdAt"), cell: ({ row }) => format.dateTime(new Date(row.original.createdAt), { dateStyle: "medium", timeZone: "UTC" }) },
    { id: "actions", header: t("actions"), cell: ({ row }: { row: { original: ServiceRequest } }) =>
      <ServiceRequestActionsMenu request={row.original} onView={onView} onEdit={onEdit}
        onChangeStatus={onChangeStatus} onDelete={onDelete} /> },
  ];
  return <DataTable tableId={embedded ? "client-service-requests" : "service-requests-list"} columns={columns} data={requests}
    getRowId={(request) => request.id} dataEmptyText={t("empty")} showPagination={false}
    headerConfig={embedded ? undefined : { title: t("title"), icon: <ListChecks className="h-6 w-6" /> }} showHeader={!embedded} />;
}
