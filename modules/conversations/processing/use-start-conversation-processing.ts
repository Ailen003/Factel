"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { startConversationProcessingAction } from "../lib/actions/conversation.actions";

export default function useStartConversationProcessing(onStarted: () => void | Promise<void>) {
  const t = useTranslations("conversations");
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const idempotencyKey = useRef<string | null>(null);

  const execute = useCallback(async (conversationId: string, expectedVersion: number) => {
    if (locked.current) return;
    locked.current = true;
    setLoading(true);
    setError(null);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const response = await startConversationProcessingAction({ conversationId, expectedVersion, idempotencyKey: idempotencyKey.current });
      if (!response.success) {
        const code = response.error?.code ?? "INTERNAL_ERROR";
        setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.INTERNAL_ERROR"));
        return;
      }
      idempotencyKey.current = null;
      await onStarted();
    } catch {
      setError(t("errors.INTERNAL_ERROR"));
    } finally {
      locked.current = false;
      setLoading(false);
    }
  }, [onStarted, t]);

  const reset = useCallback(() => setError(null), []);
  return { execute, isLoading, error, reset };
}
