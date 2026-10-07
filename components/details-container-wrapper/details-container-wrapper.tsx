"use client";

import { LoadingDataSpinner } from "@/components/ui/loading-data-spinner";
import { ReactNode } from "react";
import { useTranslations } from "next-intl";

export interface DetailsContainerWrapperProps<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  entityKey: "user" | "client" | "serviceRequest";
  containerClassName?: string;
  combineErrorAndNotFound?: boolean;
  children: (data: T) => ReactNode;
}

export function DetailsContainerWrapper<T>({
  data,
  isLoading,
  error,
  entityKey,
  containerClassName = "flex flex-col items-center justify-center gap-4 py-32 min-h-100",
  combineErrorAndNotFound = false,
  children,
}: DetailsContainerWrapperProps<T>) {
  const t = useTranslations("detailsContainer");

  const loadingText = `${t("loading")} ${t(entityKey)}`;
  const loadingSubtitle = t("loadingSubtitle");
  const errorText = `${t("error")} ${t(entityKey)}`;
  const notFoundText = `${t(entityKey)} ${t("notFound")}`;

  if (isLoading) {
    return (
      <LoadingDataSpinner
        loadingText={loadingText}
        loadingSubtitle={loadingSubtitle}
      />
    );
  }

  if (combineErrorAndNotFound && (error || !data)) {
    return (
      <div className={containerClassName}>
        <div className="text-destructive text-lg font-semibold">
          {errorText}
        </div>
        {error && <div className="text-muted-foreground">{error}</div>}
      </div>
    );
  }

  if (error) {
    return (
      <div className={containerClassName}>
        <div className="text-destructive text-lg font-semibold">
          {errorText}
        </div>
        <div className="text-muted-foreground">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={containerClassName}>
        <div className="text-muted-foreground">{notFoundText}</div>
      </div>
    );
  }

  return <>{children(data)}</>;
}
