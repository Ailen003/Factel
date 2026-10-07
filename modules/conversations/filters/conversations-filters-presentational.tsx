"use client";

import { ArrowDownAZ, ArrowUpZA } from "lucide-react";
import { useTranslations } from "next-intl";
import SelectInput from "@/components/inputs/select-input/select-input";
import { Button } from "@/components/ui/button";
import type { ConversationFilterState } from "./conversation-filter-url";
import { conversationStatuses } from "../lib/types/conversation.types";

export default function ConversationsFiltersPresentational({ filters, onChange }: {
  filters: ConversationFilterState;
  onChange: (update: Partial<ConversationFilterState>) => void;
}) {
  const t = useTranslations("conversations");
  const shared = useTranslations("filters");
  return <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
    <SelectInput label={t("fields.source")} placeholder={t("filters.allSources")} value={filters.sourceType || undefined}
      onValueChange={(value) => onChange({ sourceType: value as ConversationFilterState["sourceType"] })}
      clearable={filters.sourceType ? { handleClear: () => onChange({ sourceType: "" }) } : undefined}
      options={["upload", "microphone"].map((value) => ({ value, label: t(`sources.${value}`) }))} />
    <SelectInput label={t("fields.locale")} placeholder={t("filters.allLocales")} value={filters.locale || undefined}
      onValueChange={(value) => onChange({ locale: value as ConversationFilterState["locale"] })}
      clearable={filters.locale ? { handleClear: () => onChange({ locale: "" }) } : undefined}
      options={["en", "es"].map((value) => ({ value, label: t(`locales.${value}`) }))} />
    <SelectInput label={shared("status")} placeholder={t("filters.allStatuses")} value={filters.status || undefined}
      onValueChange={(value) => onChange({ status: value as ConversationFilterState["status"] })}
      clearable={filters.status ? { handleClear: () => onChange({ status: "" }) } : undefined}
      options={conversationStatuses.map((value) => ({ value, label: t(`statuses.${value}`) }))} />
    <SelectInput label={shared("sortBy")} value={filters.sortBy}
      onValueChange={(value) => onChange({ sortBy: value as ConversationFilterState["sortBy"] })}
      options={["createdAt", "updatedAt"].map((value) => ({ value, label: t(`fields.${value}`) }))} />
    <Button size="icon" variant="outline" aria-label={shared(filters.sortOrder === "asc" ? "sortDescending" : "sortAscending")}
      onClick={() => onChange({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })}>
      {filters.sortOrder === "asc" ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpZA className="h-4 w-4" />}
    </Button>
  </div>;
}
