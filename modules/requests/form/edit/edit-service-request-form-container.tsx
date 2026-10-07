"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import ServiceRequestForm from "../service-request-form";
import { useClientCatalog } from "../../lib/hooks/use-client-catalog";
import { useEditServiceRequest } from "../../lib/hooks/use-edit-service-request";
import type { ServiceRequest } from "../../lib/types/service-request.types";
import { editServiceRequestSchemaFactory, type EditServiceRequestSchema } from "./schemas/edit-service-request-schema";

export default function EditServiceRequestFormContainer({ request, onClose, onSuccess }: {
  request: ServiceRequest;
  onClose: () => void;
  onSuccess: (request: ServiceRequest) => void;
}) {
  const validation = useTranslations("requestForm.validation");
  const mutation = useEditServiceRequest(onSuccess);
  const catalog = useClientCatalog(request.client.id);
  const form = useForm<EditServiceRequestSchema>({
    resolver: zodResolver(editServiceRequestSchemaFactory({
      clientRequired: validation("clientRequired"),
      titleRequired: validation("titleRequired"),
      descriptionRequired: validation("descriptionRequired"),
      serviceTypeRequired: validation("serviceTypeRequired"),
      priorityRequired: validation("priorityRequired"),
      tooLong: validation("tooLong"),
    })),
    defaultValues: {
      clientId: request.client.id,
      title: request.title,
      description: request.description,
      serviceType: request.serviceType,
      priority: request.priority,
      preferredSchedule: request.preferredSchedule ?? "",
      serviceAddress: request.serviceAddress ?? "",
      nextSteps: request.nextSteps ?? "",
    },
  });

  return <FormProvider {...form}>
    <form noValidate onSubmit={form.handleSubmit((values) => mutation.save(request.id, request.version, values))} className="h-full">
      <ServiceRequestForm mode="edit" loading={mutation.isLoading} error={mutation.error} onCancel={onClose}
        clients={catalog.options} clientsLoading={catalog.isLoading} clientsError={catalog.error}
        onClientSearch={catalog.setSearch} hasNextClientsPage={catalog.hasNextPage}
        isFetchingNextClientsPage={catalog.isFetchingNextPage} onLoadNextClientsPage={() => void catalog.loadNextPage()} />
    </form>
  </FormProvider>;
}
