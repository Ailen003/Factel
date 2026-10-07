"use client";

import { useTranslations } from "next-intl";
import { clientFieldKeys, requestFieldKeys, type ProposalField, type ProposalRevisionView } from "../lib/types/proposal.types";
import { RevisionAttribution } from "./conversation-review-history";
import ConversationReviewFindings from "./conversation-review-findings";
import ReviewFieldEvidenceButton from "./review-field-evidence-button";

export default function ConversationReviewPreview({ revision, onEvidence }: { revision: ProposalRevisionView; onEvidence: (field: ProposalField | null) => void }) {
  const t = useTranslations("conversationReview");
  const clients = useTranslations("clients.fields");
  const requests = useTranslations("requests");
  return <section className="space-y-4 rounded-lg border p-4" aria-label={t("preview")}>
    <h3 className="font-semibold">{t("preview")}</h3>
    <p className="text-sm text-muted-foreground"><RevisionAttribution revision={revision} /></p>
    <h4 className="font-medium">{t("client")}</h4>
    <dl className="space-y-3">{clientFieldKeys.map((key) => <div key={key}>
      <dt className="text-sm text-muted-foreground">{clients(key)}</dt><dd className="whitespace-pre-wrap break-words text-sm">{revision.draft.client[key] || t("emptyValue")}</dd>
      <ReviewFieldEvidenceButton label={clients(key)} onClick={() => onEvidence(revision.fields.find((field) => field.target === "client" && field.fieldKey === key) ?? null)} />
    </div>)}</dl>
    {revision.draft.requests.map((item, index) => <section key={item.stableItemId} className="space-y-3 rounded-lg border p-3">
      <h4 className="font-medium">{t("requestNumber", { number: index + 1 })}</h4>
      <dl className="space-y-3">{requestFieldKeys.map((key) => <div key={key}>
        <dt className="text-sm text-muted-foreground">{requests(`fields.${key}`)}</dt>
        <dd className="whitespace-pre-wrap break-words text-sm">{!item[key] ? t("emptyValue") : key === "serviceType" ? requests(`serviceTypes.${item[key]}`) : key === "priority" ? requests(`priorities.${item[key]}`) : item[key]}</dd>
        <ReviewFieldEvidenceButton label={requests(`fields.${key}`)} onClick={() => onEvidence(revision.fields.find((field) => field.target === "request" && field.itemId === item.stableItemId && field.fieldKey === key) ?? null)} />
      </div>)}</dl>
    </section>)}
    <ConversationReviewFindings findings={revision.findings} requestItems={revision.draft.requests} resolutions={{}} onResolution={() => undefined} disabled />
  </section>;
}
