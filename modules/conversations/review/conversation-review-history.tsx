"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ProposalHistory, ProposalRevisionView } from "../lib/types/proposal.types";

export function RevisionAttribution({ revision }: { revision: Pick<ProposalRevisionView, "revisionNumber" | "authorKind" | "authorName" | "createdAt" | "readyAt"> }) {
  const t = useTranslations("conversationReview");
  const format = useFormatter();
  return <span>{t("revisionAttribution", { number: revision.revisionNumber, author: revision.authorName ?? t(revision.authorKind === "extraction" ? "aiAuthor" : "unknownAuthor"), date: format.dateTime(new Date(revision.createdAt), { dateStyle: "medium", timeStyle: "short" }) })}</span>;
}

export default function ConversationReviewHistory({ history, loading, disabled, onLoad, onSelect }: {
  history: ProposalHistory | null; loading: boolean; disabled: boolean; onLoad: (cursor?: string) => void; onSelect: (id: string) => void;
}) {
  const t = useTranslations("conversationReview");
  return <section className="space-y-2" aria-label={t("history")}>
    <Button type="button" variant="outline" disabled={disabled || loading} onClick={() => onLoad()}>{loading ? t("loading") : t("history")}</Button>
    {history && <ul className="space-y-2">{history.revisions.map((revision) => <li key={revision.id}>
      <Button type="button" variant="ghost" disabled={disabled || loading} onClick={() => onSelect(revision.id)} className="h-auto whitespace-normal text-left text-sm">
        <RevisionAttribution revision={revision} />
      </Button>
    </li>)}</ul>}
    {history?.nextCursor && <Button type="button" variant="outline" disabled={disabled || loading} onClick={() => onLoad(history.nextCursor!)}>{t("moreHistory")}</Button>}
  </section>;
}
