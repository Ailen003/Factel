"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isResolvableFinding, type ProposalFinding } from "../lib/types/proposal.types";

export default function ConversationReviewFindings({ findings, resolutions, onResolution, disabled = false, requestItems = [] }: {
  requestItems?: Array<{ stableItemId: string }>;
  findings: ProposalFinding[]; resolutions: Record<string, string>; onResolution: (id: string, reason: string) => void; disabled?: boolean;
}) {
  const t = useTranslations("conversationReview");
  const clients = useTranslations("clients.fields");
  const requests = useTranslations("requests.fields");
  return <section className="space-y-3" aria-labelledby="review-findings-title">
    <h3 id="review-findings-title" className="font-semibold">{t("findings", { count: findings.length })}</h3>
    {findings.length === 0 && <p className="text-sm text-muted-foreground">{t("noFindings")}</p>}
    {findings.map((finding) => <div key={finding.id} className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2"><Badge variant={finding.severity === "blocking" && !finding.resolution ? "destructive" : "secondary"}>
        {finding.resolution ? t("resolved") : t(`severity.${finding.severity}`)}</Badge>
        {finding.target === "request" && requestItems.some((item) => item.stableItemId === finding.itemId) && <span className="text-sm font-medium">
          {t("requestNumber", { number: requestItems.findIndex((item) => item.stableItemId === finding.itemId) + 1 })}
        </span>}
        {finding.fieldKey && <span className="text-sm font-medium">{finding.target === "client" ? clients(finding.fieldKey) : requests(finding.fieldKey)}</span>}
      </div>
      <p className="text-sm">{finding.code === "AMBIGUITY" && finding.target === "client" && (finding.fieldKey === "phone" || finding.fieldKey === "email")
        ? t(`contactReview.${finding.fieldKey}`) : t(`findingCodes.${finding.code}`)}</p>
      {finding.resolution ? <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{finding.resolution}</p>
        : isResolvableFinding(finding.code) && <div className="space-y-1">
          <Label htmlFor={`resolution-${finding.id}`}>{t("resolutionReason")}</Label>
          <Textarea id={`resolution-${finding.id}`} value={resolutions[finding.id] ?? ""} maxLength={1000} rows={2} disabled={disabled}
            onChange={(event) => onResolution(finding.id, event.target.value)} />
          <p className="text-xs text-muted-foreground">{t("resolutionHint")}</p>
        </div>}
    </div>)}
  </section>;
}
