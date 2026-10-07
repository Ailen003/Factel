import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LayoutDashboard } from "lucide-react";
import { ModuleHeader } from "@/modules/components/module-header/module-header";
import CreateClientTrigger from "@/modules/clients/form/create/create-client-trigger";
import CreateServiceRequestTrigger from "@/modules/requests/form/create/create-service-request-trigger";
import DashboardMetricsContainer from "./components/dashboard-metrics-container";
import DashboardLoadingSkeleton from "./components/dashboard-loading-skeleton";

export async function DashboardContent() {
  const t = await getTranslations("operationalDashboard");

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title={t("title")}
        description={t("description")}
        icon={<LayoutDashboard className="h-10 w-10" />}
        actionTrigger={
          <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 sm:col-span-1">
            <CreateClientTrigger />
            <CreateServiceRequestTrigger />
          </div>
        }
        showRefresh
      />

      <Suspense fallback={<DashboardLoadingSkeleton />}>
        <DashboardMetricsContainer />
      </Suspense>
    </div>
  );
}
