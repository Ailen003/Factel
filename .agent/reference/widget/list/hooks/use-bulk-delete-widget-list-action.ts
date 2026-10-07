"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteWidgetsBulkAction } from "../../lib/actions/widget.actions";
import { useTranslations } from "next-intl";

export function useBulkDeleteWidgetListAction() {
  const t = useTranslations("widgets");
  const [isDeletingWidgets, setIsDeletingWidgets] = useState(false);
  const router = useRouter();

  const handleBulkDelete = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    setIsDeletingWidgets(true);
    try {
      const response = await deleteWidgetsBulkAction(ids);
      if (response.success) {
        toast.success(t("bulkDeleteSuccess", { count: response.data.deleted }), { position: "top-right" });
        setTimeout(() => { router.refresh(); }, 300);
      } else {
        toast.error(t("bulkDeleteError"), { position: "top-right" });
      }
    } finally {
      setIsDeletingWidgets(false);
    }
  }, [router, t]);

  return { isDeletingWidgets, handleBulkDelete };
}
