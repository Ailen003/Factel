"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteClientAction } from "../actions/client.actions";

export function useDeleteClient(onSuccess: () => void) {
  const t = useTranslations("clients");
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const execute = useCallback(async (id: string, expectedVersion: number) => {
    setLoading(true); setError(null);
    try {
      const response = await deleteClientAction({ id, expectedVersion });
      if (response.success) onSuccess();
      else setError(t.has(`errors.${response.error.code}` as never) ? t(`errors.${response.error.code}` as never) : t("errors.INTERNAL_ERROR"));
    } catch { setError(t("errors.INTERNAL_ERROR")); }
    finally { setLoading(false); }
  }, [onSuccess, t]);
  const reset = useCallback(() => setError(null), []);
  return { execute, isLoading, error, reset };
}
