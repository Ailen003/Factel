"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { RHFTextField } from "@/components/form/rhf-components/rhf-text-field/rhf-text-field";
import { RHFTextAreaField } from "@/components/form/rhf-components/rhf-text-area-field/rhf-text-area-field";
import { RHFSelectField } from "@/components/form/rhf-components/rhf-select-field/rhf-select-field";
import FormActionFooter from "@/components/form/components/form-action-footer";
import { AlertComponent } from "@/components/ui/alert-component";
import { REQUEST_PRIORITIES, SERVICE_TYPES, type CreateServiceRequestSchema } from "./create/schemas/create-service-request-schema";
import type { ClientCatalogOption } from "../lib/types/service-request.types";

export default function ServiceRequestForm({ mode = "create", loading, error, onCancel, clients, clientsLoading, clientsError,
  onClientSearch, hasNextClientsPage, isFetchingNextClientsPage, onLoadNextClientsPage }: {
  mode?: "create" | "edit";
  loading: boolean; error: string | null; onCancel: () => void; clients: ClientCatalogOption[];
  clientsLoading: boolean; clientsError: string | null; onClientSearch: (value: string) => void;
  hasNextClientsPage: boolean; isFetchingNextClientsPage: boolean; onLoadNextClientsPage: () => void;
}) {
  const t = useTranslations("requestForm");
  const requests = useTranslations("requests");
  const { formState } = useFormContext<CreateServiceRequestSchema>();
  return <div className="flex h-full flex-col">
    <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
      {error && <AlertComponent title={error} variant="destructive" />}
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <fieldset disabled={loading || formState.isSubmitting} className="space-y-4">
        <RHFSelectField name="clientId" label={requests("fields.client")} placeholder={t("clientPlaceholder")}
          options={clients.map((client) => ({ value: client.id, label: client.label }))}
          loading={clientsLoading} emptyText={clientsError ?? t("noClients")} searchable searchPlaceholder={t("searchClients")}
          onSearch={onClientSearch} hasNextPage={hasNextClientsPage} isFetchingNextPage={isFetchingNextClientsPage}
          onLoadNextPage={onLoadNextClientsPage} />
        <RHFTextField name="title" label={requests("fields.title")} fullWidth />
        <RHFTextAreaField name="description" label={requests("fields.description")} rows={4} />
        <div className="grid gap-4 sm:grid-cols-2">
          <RHFSelectField name="serviceType" label={requests("fields.serviceType")}
            options={SERVICE_TYPES.map((value) => ({ value, label: requests(`serviceTypes.${value}`) }))} />
          <RHFSelectField name="priority" label={requests("fields.priority")}
            options={REQUEST_PRIORITIES.map((value) => ({ value, label: requests(`priorities.${value}`) }))} />
        </div>
        <RHFTextAreaField name="preferredSchedule" label={requests("fields.preferredSchedule")} description={t("scheduleHint")} rows={2} />
        <RHFTextAreaField name="serviceAddress" label={requests("fields.serviceAddress")} rows={2} />
        <RHFTextAreaField name="nextSteps" label={requests("fields.nextSteps")} rows={3} />
      </fieldset>
    </div>
    <FormActionFooter loading={loading} onCancel={onCancel} cancelButtonText={t("cancel")}
      submitButtonText={t(mode === "edit" ? "save" : "review")}
      loadingText={t(mode === "edit" ? "saving" : "preparing")} />
  </div>;
}
