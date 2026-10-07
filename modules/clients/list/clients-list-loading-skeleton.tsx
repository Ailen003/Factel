"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientsListLoadingSkeleton() {
  const t = useTranslations("clients");
  return <div role="status" aria-label={t("loading")} className="space-y-3 rounded-lg border p-4">
    <span className="sr-only">{t("loading")}</span>
    <Skeleton className="h-8 w-40" />
    {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}
  </div>;
}
