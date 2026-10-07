"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export default function ConversationStatusBadge({ status }: { status: string }) {
  const t = useTranslations("conversations");
  const variant = status === "failed" || status === "quota_blocked" ? "destructive"
    : status === "completed" || status === "audio_ready" || status === "transcribed" || status === "ready" ? "default" : "secondary";
  return <Badge variant={variant}>{t.has(`statuses.${status}`) ? t(`statuses.${status}`) : status}</Badge>;
}
