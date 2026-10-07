import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { UsersRound } from "lucide-react";
import { ModuleHeader } from "@/modules/components/module-header/module-header";
import type { ClientFiltersDto } from "./lib/types/client.types";
import ClientsFiltersContainer from "./filters/clients-filters-container";
import ClientsListContainer from "./list/clients-list-container";
import ClientsListLoadingSkeleton from "./list/clients-list-loading-skeleton";
import CreateClientTrigger from "./form/create/create-client-trigger";

export default async function ClientsContent({ filters }: { filters: ClientFiltersDto }) {
  const t = await getTranslations("clients");
  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title={t("title")} description={t("description")} icon={<UsersRound className="h-10 w-10" />} actionTrigger={<CreateClientTrigger />} showRefresh />
      <ClientsFiltersContainer />
      <Suspense key={JSON.stringify(filters)} fallback={<ClientsListLoadingSkeleton />}>
        <ClientsListContainer filters={filters} />
      </Suspense>
    </div>
  );
}
