"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LoadingDataSpinner } from "@/components/ui/loading-data-spinner";
import type { WidgetDetails } from "../lib/types/widget.types";

interface Props {
  data: WidgetDetails | null;
  isLoading: boolean;
  error: string | null;
  children: (widget: WidgetDetails) => ReactNode;
}

export default function WidgetDetailsState({ data, isLoading, error, children }: Props) {
  const t = useTranslations("widgetDetails");

  if (isLoading) {
    return <LoadingDataSpinner loadingText={t("loading")} loadingSubtitle={t("loadingSubtitle")} />;
  }

  if (error) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 py-10">
        <p className="font-semibold text-destructive">{t("loadError")}</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-40 items-center justify-center py-10 text-sm text-muted-foreground">
        {t("notFound")}
      </div>
    );
  }

  return <>{children(data)}</>;
}
