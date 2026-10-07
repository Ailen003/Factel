import { conversationStatuses, type ConversationFiltersDto, type ConversationStatus } from "../lib/types/conversation.types";

export interface ConversationFilterState {
  sourceType: "" | "upload" | "microphone";
  locale: "" | "en" | "es";
  status: "" | ConversationStatus;
  sortBy: "createdAt" | "updatedAt";
  sortOrder: "asc" | "desc";
}

export const DEFAULT_CONVERSATION_FILTERS: ConversationFilterState = {
  sourceType: "", locale: "", status: "", sortBy: "createdAt", sortOrder: "desc",
};

export function readConversationFilters(params: URLSearchParams): ConversationFilterState {
  const sourceType = params.get("sourceType");
  const locale = params.get("locale");
  const status = params.get("status");
  return {
    sourceType: sourceType === "upload" || sourceType === "microphone" ? sourceType : "",
    locale: locale === "en" || locale === "es" ? locale : "",
    status: conversationStatuses.includes(status as ConversationStatus) ? status as ConversationStatus : "",
    sortBy: params.get("sortBy") === "updatedAt" ? "updatedAt" : "createdAt",
    sortOrder: params.get("sortOrder") === "asc" ? "asc" : "desc",
  };
}

export function conversationFiltersToDto(filters: ConversationFilterState): Omit<ConversationFiltersDto, "page" | "limit"> {
  return {
    sourceType: filters.sourceType || undefined,
    locale: filters.locale || undefined,
    status: filters.status || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  } as Omit<ConversationFiltersDto, "page" | "limit">;
}
