"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ReviewFieldEvidenceButton({ label, onClick }: { label: string; onClick: () => void }) {
  const t = useTranslations("conversationReview");
  return <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onClick}
    aria-label={t("evidenceFor", { field: label })}>{t("showEvidence")}</Button>;
}
