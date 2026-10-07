"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('refresh');

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
      toast.success(t('dataRefreshed'));
    });
  };

  return (
    <Button
      variant="outline"
      
      onClick={handleRefresh}
      disabled={isPending}
      aria-label={t('refreshDataAria')}
    >
      <RefreshCw
        className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      {t('refreshData')}
    </Button>
  );
}
