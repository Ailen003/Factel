"use client";

import { DetailsContainerWrapper } from "@/components/details-container-wrapper/details-container-wrapper";
import { useServiceRequest } from "../../lib/hooks/use-service-request";
import type { ServiceRequest } from "../../lib/types/service-request.types";
import EditServiceRequestFormContainer from "./edit-service-request-form-container";

export default function EditServiceRequestContainer({ requestId, onClose, onSuccess }: {
  requestId: string;
  onClose: () => void;
  onSuccess: (request: ServiceRequest) => void;
}) {
  const { request, isLoading, error } = useServiceRequest({ requestId });

  return <DetailsContainerWrapper data={request} isLoading={isLoading} error={error} entityKey="serviceRequest"
    containerClassName="flex min-h-[400px] flex-col items-center justify-center gap-4 py-32">
    {(data) => <EditServiceRequestFormContainer request={data} onClose={onClose} onSuccess={onSuccess} />}
  </DetailsContainerWrapper>;
}
