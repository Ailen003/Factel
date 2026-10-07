"use client";

import { useTranslations } from "next-intl";
import { LoadingDataSkeleton } from "@/components/ui/loading-data-skeleton";

export default function UsersListLoadingSkeleton() {
  const t = useTranslations('users');
  return (
    <LoadingDataSkeleton
      loadingText={t('loadingUsers')}
      loadingSubtitle={t('fetchingUsersData')}
    />
  );
}
