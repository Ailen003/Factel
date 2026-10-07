import { Suspense } from "react";
import { MessagesSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ModuleHeader } from "@/modules/components/module-header/module-header";
import type { ConversationFiltersDto } from "./lib/types/conversation.types";
import ConversationsFiltersContainer from "./filters/conversations-filters-container";
import ConversationsListContainer from "./list/conversations-list-container";
import ConversationsListLoadingSkeleton from "./list/conversations-list-loading-skeleton";
import CreateConversationTrigger from "./upload/create-conversation-trigger";
import RecordConversationTrigger from "./recording/record-conversation-trigger";
import { getConversationUploadPolicyAction } from "./lib/actions/conversation.actions";

export default async function ConversationsContent({ filters, routeLocale }: {
  filters: ConversationFiltersDto;
  routeLocale: string;
}) {
  const t = await getTranslations("conversations");
  const policyResponse = await getConversationUploadPolicyAction();
  return <div className="flex flex-col gap-6">
    <ModuleHeader title={t("title")} description={t("description")}
      icon={<MessagesSquare className="h-10 w-10" />} actionTrigger={<>
        <RecordConversationTrigger routeLocale={routeLocale} policy={policyResponse.success ? policyResponse.data : null} />
        <CreateConversationTrigger routeLocale={routeLocale} policy={policyResponse.success ? policyResponse.data : null} />
      </>} showRefresh />
    <ConversationsFiltersContainer />
    <Suspense key={JSON.stringify(filters)} fallback={<ConversationsListLoadingSkeleton />}>
      <ConversationsListContainer filters={filters} />
    </Suspense>
  </div>;
}
