import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ListChecks } from "lucide-react";
import { ModuleHeader } from "@/modules/components/module-header/module-header";
import type { ServiceRequestFiltersDto } from "./lib/types/service-request.types";
import ServiceRequestFiltersContainer from "./filters/service-request-filters-container";
import ServiceRequestListContainer from "./list/service-request-list-container";
import ServiceRequestListLoadingSkeleton from "./list/service-request-list-loading-skeleton";
import CreateServiceRequestTrigger from "./form/create/create-service-request-trigger";

export default async function RequestsContent({ filters }: { filters: ServiceRequestFiltersDto }) {
  const t = await getTranslations("requests");
  return <div className="flex flex-col gap-6">
    <ModuleHeader title={t("title")} description={t("description")} icon={<ListChecks className="h-10 w-10" />}
      actionTrigger={<CreateServiceRequestTrigger />} showRefresh />
    <ServiceRequestFiltersContainer />
    <Suspense key={JSON.stringify(filters)} fallback={<ServiceRequestListLoadingSkeleton />}>
      <ServiceRequestListContainer filters={filters} />
    </Suspense>
  </div>;
}
