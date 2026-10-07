"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConversationsListLoadingSkeleton() {
  const t = useTranslations("conversations");
  return <div role="status" aria-label={t("loading")} className="space-y-3 rounded-lg border p-4">
    <span className="sr-only">{t("loading")}</span>
    <Skeleton className="h-8 w-48" />
    {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}
  </div>;
}
