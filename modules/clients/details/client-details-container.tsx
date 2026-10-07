"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DetailsContainerWrapper } from "@/components/details-container-wrapper/details-container-wrapper";
import { Button } from "@/components/ui/button";
import { useClient } from "../lib/hooks/use-client";
import ClientDetailsPresentational from "./client-details-presentational";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClientServiceRequestsTab from "@/modules/requests/components/client-service-requests-tab";

export default function ClientDetailsContainer({ clientId }: { clientId: string }) {
  const { client, isLoading, error, getClient } = useClient({ clientId });
  const [activeTab, setActiveTab] = useState("information");
  const t = useTranslations("clients");
  return <div>
    <DetailsContainerWrapper data={client} isLoading={isLoading} error={error} entityKey="client" containerClassName="space-y-3 py-8">
      {(data) => <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList><TabsTrigger value="information">{t("detailsTabs.information")}</TabsTrigger>
          <TabsTrigger value="requests" onClick={() => setActiveTab("requests")}>{t("detailsTabs.requests")}</TabsTrigger></TabsList>
        <TabsContent value="information" className="pt-4"><ClientDetailsPresentational client={data} /></TabsContent>
        <TabsContent value="requests">{activeTab === "requests" && <ClientServiceRequestsTab clientId={data.id} />}</TabsContent>
      </Tabs>}
    </DetailsContainerWrapper>
    {error && <Button variant="outline" onClick={() => void getClient()}>{t("retry")}</Button>}
  </div>;
}
