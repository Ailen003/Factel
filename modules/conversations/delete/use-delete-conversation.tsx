"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteConversationAction } from "../lib/actions/conversation.actions";

export default function useDeleteConversation(onSuccess: () => void) {
  const t = useTranslations("conversations");
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const execute = useCallback(async (id: string, expectedVersion: number) => {
    setLoading(true); setError(null);
    try {
      const response = await deleteConversationAction({ id, expectedVersion });
      if (response.success) onSuccess();
      else setError(t.has(`errors.${response.error.code}`) ? t(`errors.${response.error.code}`) : t("errors.INTERNAL_ERROR"));
    } catch { setError(t("errors.INTERNAL_ERROR")); }
    finally { setLoading(false); }
  }, [onSuccess, t]);
  const reset = useCallback(() => setError(null), []);
  return { execute, isLoading, error, reset };
}
