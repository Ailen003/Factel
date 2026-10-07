"use client";

import { useFormatter, useTranslations } from "next-intl";
import { CardViewWrapper } from "@/components/ui/card-view-wrapper";
import type { ConversationSummary } from "../lib/types/conversation.types";
import ConversationActionsMenu from "../components/conversation-actions-menu";
import ConversationStatusBadge from "../components/conversation-status-badge";

function formatDuration(durationMs: number | null | undefined) {
  if (durationMs == null) return null;
  const seconds = Math.floor(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function ConversationsListCardsView({ conversations, onView, onDelete }: {
  conversations: ConversationSummary[]; onView: (id: string) => void; onDelete: (id: string) => void;
}) {
  const t = useTranslations("conversations");
  const format = useFormatter();
  return <CardViewWrapper headerConfig={{ title: t("title") }}>
    {conversations.length === 0 ? <p className="rounded-lg border p-6 text-center text-muted-foreground">{t("empty")}</p>
      : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{conversations.map((item) => {
        const date = format.dateTime(new Date(item.createdAt), { dateStyle: "medium", timeStyle: "short" });
        return <article key={item.id} className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2"><p className="font-semibold">{date}</p><ConversationStatusBadge status={item.status} /></div>
            <ConversationActionsMenu conversationId={item.id} label={date} onView={onView} onDelete={onDelete}
              canDelete={item.status === "draft" || item.status === "audio_ready"} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">{t("fields.source")}</dt><dd>{t(`sources.${item.sourceType}`)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("fields.locale")}</dt><dd>{t(`locales.${item.locale}`)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("fields.duration")}</dt><dd>{formatDuration(item.durationMs) ?? t("notAvailable")}</dd></div>
          </dl>
        </article>;
      })}</div>}
  </CardViewWrapper>;
}
