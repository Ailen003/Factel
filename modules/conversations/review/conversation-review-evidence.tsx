"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ConversationDetails } from "../lib/types/conversation.types";
import type { ProposalField } from "../lib/types/proposal.types";

export default function ConversationReviewEvidence({ field, transcript, onSeek, canSeek }: {
  field: ProposalField | null; transcript: ConversationDetails["transcript"]; onSeek: (startMs: number) => void; canSeek: boolean;
}) {
  const t = useTranslations("conversationReview");
  const clients = useTranslations("clients.fields");
  const requests = useTranslations("requests.fields");
  const segments = transcript?.segments.filter((segment) => field?.evidenceIds.includes(segment.id)) ?? [];
  return <aside className="space-y-3 rounded-lg border bg-muted/20 p-4 lg:sticky lg:top-0" aria-label={t("evidence")}>
    <h3 className="font-semibold">{t("evidence")}</h3>
    {!field ? <p className="text-sm text-muted-foreground">{t("selectField")}</p> : <>
      <h4 className="font-medium">{field.target === "client" ? clients(field.fieldKey) : requests(field.fieldKey)}</h4>
      <Badge variant="outline">{t(`provenance.${field.provenance}`)}</Badge>
      {field.observedValue && <div className="text-sm"><p className="text-muted-foreground">{t("observedValue")}</p><p className="break-words whitespace-pre-wrap">{field.observedValue}</p></div>}
      {segments.length === 0 && <p className="text-sm text-muted-foreground">{t("noEvidence")}</p>}
      {segments.map((segment) => <div key={segment.id} className="space-y-2 rounded-md border bg-background p-3">
        <blockquote className="whitespace-pre-wrap break-words text-sm"><mark className="bg-primary/10 text-foreground">{segment.text}</mark></blockquote>
        {segment.startMs !== null && Number.isFinite(segment.startMs) && segment.startMs >= 0 && canSeek
          ? <Button type="button" size="sm" variant="outline" onClick={() => onSeek(segment.startMs!)}>{t("listenEvidence")}</Button>
          : <p className="text-xs text-muted-foreground">{t("noTimestamp")}</p>}
      </div>)}
      <p className="text-xs text-muted-foreground">{t("immutableEvidence")}</p>
    </>}
  </aside>;
}
