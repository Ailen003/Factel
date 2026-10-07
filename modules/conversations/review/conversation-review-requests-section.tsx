"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { RHFTextField } from "@/components/form/rhf-components/rhf-text-field/rhf-text-field";
import { RHFTextAreaField } from "@/components/form/rhf-components/rhf-text-area-field/rhf-text-area-field";
import { RHFSelectField } from "@/components/form/rhf-components/rhf-select-field/rhf-select-field";
import { SERVICE_TYPES, REQUEST_PRIORITIES } from "@/modules/requests/form/create/schemas/create-service-request-schema";
import { emptyRequestDraft, requestFieldKeys, type ProposalDraft, type RequestFieldKey } from "../lib/types/proposal.types";
import ReviewFieldEvidenceButton from "./review-field-evidence-button";

export default function ConversationReviewRequestsSection({ onEvidence }: { onEvidence: (itemId: string, field: RequestFieldKey) => void }) {
  const t = useTranslations("conversationReview");
  const requests = useTranslations("requests");
  const { control } = useFormContext<ProposalDraft>();
  const { fields, append, remove } = useFieldArray({ control, name: "requests" });
  return <section className="space-y-4" aria-labelledby="review-requests-title">
    <h3 id="review-requests-title" className="font-semibold">{t("requests", { count: fields.length })}</h3>
    {fields.map((item, index) => <section key={item.id} className="space-y-4 rounded-lg border p-4" aria-label={t("requestNumber", { number: index + 1 })}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium">{t("requestNumber", { number: index + 1 })}</h4>
        <Button type="button" variant="ghost" size="sm" disabled={fields.length <= 1} onClick={() => remove(index)}
          aria-label={t("removeRequestNumber", { number: index + 1 })}>{t("removeRequest")}</Button>
      </div>
      {requestFieldKeys.map((field) => <div key={field} className="space-y-1">
        {field === "title" ? <RHFTextField name={`requests.${index}.${field}`} label={requests(`fields.${field}`)} />
          : field === "serviceType" || field === "priority" ? <RHFSelectField name={`requests.${index}.${field}`} label={requests(`fields.${field}`)}
            options={(field === "serviceType" ? SERVICE_TYPES : REQUEST_PRIORITIES).map((value) => ({ value, label: requests(`${field === "serviceType" ? "serviceTypes" : "priorities"}.${value}`) }))} />
          : <RHFTextAreaField name={`requests.${index}.${field}`} label={requests(`fields.${field}`)} rows={2} />}
        <ReviewFieldEvidenceButton label={requests(`fields.${field}`)} onClick={() => onEvidence(item.stableItemId, field)} />
      </div>)}
    </section>)}
    <Button type="button" variant="outline" disabled={fields.length >= 50} onClick={() => append(emptyRequestDraft(crypto.randomUUID()))}>{t("addRequest")}</Button>
  </section>;
}
