import ModulePagination from "@/components/pagination/module-pagination";
import { getConversationsAction } from "../lib/actions/conversation.actions";
import type { ConversationFiltersDto } from "../lib/types/conversation.types";
import ConversationsListPresentational from "./conversations-list-presentational";

export default async function ConversationsListContainer({ filters }: { filters: ConversationFiltersDto }) {
  const response = await getConversationsAction(filters);
  return <div>
    <ConversationsListPresentational response={response} />
    {response.success && <ModulePagination pagination={response.data.pagination} limitOptions={[5, 10, 20, 30]} />}
  </div>;
}
