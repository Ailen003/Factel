"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { continueConversationExtractionAction } from "../lib/actions/extraction.actions";

export default function useContinueConversationExtraction(onStarted: () => void | Promise<void>) {
  const t = useTranslations("conversationReview");
  const locked = useRef(false);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const execute = useCallback(async (conversationId: string, expectedVersion: number) => {
    if (locked.current) return;
    locked.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await continueConversationExtractionAction({ conversationId, expectedVersion });
      if (!response.success) {
        const code = response.error.code;
        setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.INTERNAL_ERROR"));
        return;
      }
      await onStarted();
    } catch { setError(t("errors.INTERNAL_ERROR")); }
    finally { locked.current = false; setLoading(false); }
  }, [onStarted, t]);
  return { execute, isLoading, error };
}
