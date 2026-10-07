"use client";

import { useTranslations } from "next-intl";
import { DetailsContainerWrapper } from "@/components/details-container-wrapper/details-container-wrapper";
import { Button } from "@/components/ui/button";
import { useServiceRequest } from "../lib/hooks/use-service-request";
import ServiceRequestDetailsPresentational from "./service-request-details-presentational";

export default function ServiceRequestDetailsContainer({ requestId }: { requestId: string }) {
  const { request, isLoading, error, load } = useServiceRequest({ requestId });
  const t = useTranslations("requests");
  return <div>
    <DetailsContainerWrapper data={request} isLoading={isLoading} error={error} entityKey="serviceRequest" containerClassName="space-y-3 py-8">
      {(data) => <ServiceRequestDetailsPresentational request={data} />}
    </DetailsContainerWrapper>
    {error && <Button variant="outline" onClick={() => void load()}>{t("retry")}</Button>}
  </div>;
}
