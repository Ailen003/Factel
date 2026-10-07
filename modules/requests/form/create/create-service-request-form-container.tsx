"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useCreateServiceRequest } from "../../lib/hooks/use-create-service-request";
import { useClientCatalog } from "../../lib/hooks/use-client-catalog";
import type { ServiceRequestCreationResult } from "../../lib/types/service-request.types";
import { createServiceRequestSchemaFactory, type CreateServiceRequestSchema } from "./schemas/create-service-request-schema";
import ServiceRequestForm from "../service-request-form";
import ServiceRequestCreationPreviewView from "./service-request-creation-preview";

export default function CreateServiceRequestFormContainer({ onClose, onSuccess, onLockChange }: {
  onClose: () => void; onSuccess: (result: ServiceRequestCreationResult) => void; onLockChange: (locked: boolean) => void;
}) {
  const validation = useTranslations("requestForm.validation");
  const creation = useCreateServiceRequest({ onSuccess, onLockChange });
  const catalog = useClientCatalog();
  const form = useForm<CreateServiceRequestSchema>({ resolver: zodResolver(createServiceRequestSchemaFactory({
    clientRequired: validation("clientRequired"), titleRequired: validation("titleRequired"),
    descriptionRequired: validation("descriptionRequired"), serviceTypeRequired: validation("serviceTypeRequired"),
    priorityRequired: validation("priorityRequired"), tooLong: validation("tooLong"),
  })), defaultValues: { clientId: "", title: "", description: "", serviceType: "other", priority: "normal",
    preferredSchedule: "", serviceAddress: "", nextSteps: "" } });
  return <FormProvider {...form}>{creation.preview ? <ServiceRequestCreationPreviewView preview={creation.preview}
    loading={creation.isLoading} error={creation.error} uncertain={creation.uncertain} expired={creation.expired}
    onConfirm={() => void creation.confirm()} onBack={creation.reset} /> :
    <form noValidate onSubmit={form.handleSubmit(creation.prepare)} onChange={creation.reset} className="h-full">
      <ServiceRequestForm loading={creation.isLoading} error={creation.error} onCancel={onClose}
        clients={catalog.options} clientsLoading={catalog.isLoading} clientsError={catalog.error}
        onClientSearch={catalog.setSearch} hasNextClientsPage={catalog.hasNextPage}
        isFetchingNextClientsPage={catalog.isFetchingNextPage} onLoadNextClientsPage={() => void catalog.loadNextPage()} />
    </form>}</FormProvider>;
}
