"use client";

import { useTranslations } from "next-intl";
import { RHFTextField } from "@/components/form/rhf-components/rhf-text-field/rhf-text-field";
import { RHFTextAreaField } from "@/components/form/rhf-components/rhf-text-area-field/rhf-text-area-field";
import { clientFieldKeys, type ClientFieldKey } from "../lib/types/proposal.types";
import ReviewFieldEvidenceButton from "./review-field-evidence-button";

export default function ConversationReviewClientSection({ onEvidence }: { onEvidence: (field: ClientFieldKey) => void }) {
  const t = useTranslations("conversationReview");
  const fields = useTranslations("clients.fields");
  return <section className="space-y-4" aria-labelledby="review-client-title">
    <h3 id="review-client-title" className="font-semibold">{t("client")}</h3>
    <p className="text-sm text-muted-foreground">{t("contactHint")}</p>
    {clientFieldKeys.map((field) => <div key={field} className="space-y-1">
      {field === "address" || field === "notes"
        ? <RHFTextAreaField name={`client.${field}`} label={fields(field)} rows={2} />
        : <RHFTextField name={`client.${field}`} label={fields(field)} type={field === "phone" ? "tel" : "text"} fullWidth />}
      <ReviewFieldEvidenceButton label={fields(field)} onClick={() => onEvidence(field)} />
    </div>)}
  </section>;
}
