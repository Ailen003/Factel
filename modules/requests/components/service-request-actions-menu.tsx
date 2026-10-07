"use client";

import { CheckCircle2, CircleDot, Edit, Eye, MoreHorizontal, PlayCircle, RotateCcw, Trash2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ServiceRequest, ServiceRequestStatus } from "../lib/types/service-request.types";
import { getAllowedServiceRequestStatuses } from "../lib/types/service-request-status-policy";

const statusIcons: Record<ServiceRequestStatus, typeof CircleDot> = {
  pending: CircleDot,
  in_progress: PlayCircle,
  resolved: CheckCircle2,
  cancelled: XCircle,
};

export default function ServiceRequestActionsMenu({ request, onView, onEdit, onChangeStatus, onDelete }: {
  request: ServiceRequest;
  onView: (request: ServiceRequest) => void;
  onEdit: (request: ServiceRequest) => void;
  onChangeStatus: (request: ServiceRequest, targetStatus: ServiceRequestStatus) => void;
  onDelete: (request: ServiceRequest) => void;
}) {
  const t = useTranslations("requests");
  return <DropdownMenu><DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon-sm" aria-label={t("actionsFor", { title: request.title })}><MoreHorizontal className="h-4 w-4" /></Button>
  </DropdownMenuTrigger><DropdownMenuContent align="end">
    <DropdownMenuItem onSelect={() => onView(request)}><Eye />{t("view")}</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onEdit(request)}><Edit />{t("editAction")}</DropdownMenuItem>
    <DropdownMenuSeparator />
    {getAllowedServiceRequestStatuses(request.status).map((status) => {
      const Icon = request.status === "resolved" || request.status === "cancelled" ? RotateCcw : statusIcons[status];
      const label = request.status === "resolved" || request.status === "cancelled"
        ? t("statusActions.reopen")
        : t(`statusActions.${status}`);
      return <DropdownMenuItem key={status} onSelect={() => onChangeStatus(request, status)}>
        <Icon />{label}
      </DropdownMenuItem>;
    })}
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive" onSelect={() => onDelete(request)}><Trash2 />{t("deleteAction")}</DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu>;
}
