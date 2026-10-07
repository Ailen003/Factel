"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ServiceResponse } from "@/lib/api-responses";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import type { ServiceRequestsResponse } from "../lib/types/service-request.types";
import { useServiceRequestManagement } from "./hooks";
import ServiceRequestManagementDialogs from "../components/service-request-management-dialogs";
import ServiceRequestListTableView from "./service-request-list-table-view";
import ServiceRequestListCardsView from "./service-request-list-cards-view";

export default function ServiceRequestListPresentational({ response }: { response: ServiceResponse<ServiceRequestsResponse> }) {
  const t = useTranslations("requests"); const router = useRouter();
  const management = useServiceRequestManagement();
  if (!response.success) return <div className="space-y-3"><AlertComponent variant="destructive"
    title={t.has(`errors.${response.error.code}` as never) ? t(`errors.${response.error.code}` as never) : t("errors.INTERNAL_ERROR")} />
    <Button variant="outline" onClick={() => router.refresh()}>{t("retry")}</Button></div>;
  return <div className="pb-4">
    <div className="hidden md:block"><ServiceRequestListTableView requests={response.data.requests}
      onView={management.view} onEdit={management.edit} onChangeStatus={management.changeStatus} onDelete={management.remove} /></div>
    <div className="block md:hidden"><ServiceRequestListCardsView requests={response.data.requests}
      onView={management.view} onEdit={management.edit} onChangeStatus={management.changeStatus} onDelete={management.remove} /></div>
    <ServiceRequestManagementDialogs management={management} onMutated={() => setTimeout(() => router.refresh(), 300)} />
  </div>;
}
