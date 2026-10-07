"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteServiceRequestAction } from "../actions/service-request.actions";
import type { DeleteServiceRequestResult } from "../types/service-request.types";

export function useDeleteServiceRequest(onSuccess?: (result: DeleteServiceRequestResult) => void) {
  const t = useTranslations("requests");
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeleteServiceRequestResult | null>(null);
  const translateError = useCallback((code: string) => {
    const key = `errors.${code}`;
    return t.has(key as never) ? t(key as never) : t("errors.INTERNAL_ERROR");
  }, [t]);
  const execute = useCallback(async (id: string, expectedVersion: number) => {
    if (isLoading) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const response = await deleteServiceRequestAction({ id, expectedVersion });
      if (response.success) { setResult(response.data); onSuccess?.(response.data); }
      else setError(translateError(response.error.code));
    } catch { setError(translateError("INTERNAL_ERROR")); }
    finally { setLoading(false); }
  }, [isLoading, onSuccess, translateError]);
  const reset = useCallback(() => { setError(null); setResult(null); }, []);
  return { execute, isLoading, error, result, reset };
}
