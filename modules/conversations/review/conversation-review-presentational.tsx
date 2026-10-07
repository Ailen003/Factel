"use client";

import { useFormContext } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AlertComponent } from "@/components/ui/alert-component";
import type { ProposalDraft, ProposalField, ProposalRevisionView } from "../lib/types/proposal.types";
import ConversationReviewClientSection from "./conversation-review-client-section";
import ConversationReviewRequestsSection from "./conversation-review-requests-section";
import ConversationReviewFindings from "./conversation-review-findings";
import { RevisionAttribution } from "./conversation-review-history";

export default function ConversationReviewPresentational({ revision, busy, conflict, dirty, resolutions, onResolution, onEvidence, onMarkReady, invalidDraft }: {
  revision: ProposalRevisionView; busy: boolean; conflict: boolean; dirty: boolean; resolutions: Record<string, string>;
  onResolution: (id: string, reason: string) => void; onEvidence: (field: ProposalField) => void; onMarkReady: () => void; invalidDraft: boolean;
}) {
  const t = useTranslations("conversationReview");
  const format = useFormatter();
  const { formState } = useFormContext<ProposalDraft>();
  const selectEvidence = (target: "client" | "request", itemId: string | null, fieldKey: ProposalField["fieldKey"]) => {
    onEvidence(revision.fields.find((field) => field.target === target && field.itemId === itemId && field.fieldKey === fieldKey)
      ?? { target, itemId, fieldKey, provenance: "manual", normalizedValue: null, observedValue: null, evidenceIds: [], confidence: null });
  };
  return <div className="space-y-6">
    <p className="text-sm text-muted-foreground"><RevisionAttribution revision={revision} /></p>
    {revision.readyAt && !dirty && <p className="rounded-lg border bg-muted/30 p-3 text-sm" role="status">{t("readyAttribution", {
      author: revision.readyByName ?? t("unknownAuthor"), date: format.dateTime(new Date(revision.readyAt), { dateStyle: "medium", timeStyle: "short" }),
    })}</p>}
    <p className="text-sm text-muted-foreground">{t("draftHint")}</p>
    {invalidDraft && <AlertComponent variant="destructive" title={t("invalidDraft")} />}
    <fieldset disabled={busy || formState.isSubmitting} className="space-y-6">
      <ConversationReviewClientSection onEvidence={(field) => selectEvidence("client", null, field)} />
      <ConversationReviewRequestsSection onEvidence={(itemId, field) => selectEvidence("request", itemId, field)} />
      <ConversationReviewFindings findings={revision.findings} requestItems={revision.draft.requests} resolutions={resolutions} onResolution={onResolution} />
    </fieldset>
    <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t bg-background py-3">
      <Button type="submit" disabled={busy || !dirty || conflict}>{busy ? t("saving") : t("save")}</Button>
      <Button type="button" variant="outline" disabled={busy || dirty || conflict || !revision.canMarkReady || !!revision.readyAt} onClick={onMarkReady}>{t("markReady")}</Button>
      <p className="text-xs text-muted-foreground" role="status">{t(dirty ? "unsaved" : revision.canMarkReady ? "readyHint" : "notReadyHint")}</p>
    </div>
  </div>;
}
