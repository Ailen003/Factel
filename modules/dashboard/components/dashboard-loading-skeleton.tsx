"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoadingSkeleton() {
  const t = useTranslations("operationalDashboard");

  return (
    <div role="status" aria-label={t("loading")} className="space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="grid gap-3 xs:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <div className="space-y-3 rounded-xl border p-4">
        <Skeleton className="h-6 w-48" />
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
