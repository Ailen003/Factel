"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { changeServiceRequestStatusAction } from "../actions/service-request.actions";
import type { ServiceRequest, ServiceRequestStatus } from "../types/service-request.types";

export function useChangeServiceRequestStatus(onSuccess?: (request: ServiceRequest) => void) {
  const t = useTranslations("requests");
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ServiceRequest | null>(null);
  const translateError = useCallback((code: string) => {
    const key = `errors.${code}`;
    return t.has(key as never) ? t(key as never) : t("errors.INTERNAL_ERROR");
  }, [t]);
  const changeStatus = useCallback(async (id: string, expectedVersion: number, status: ServiceRequestStatus) => {
    if (isLoading) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const response = await changeServiceRequestStatusAction({ id, expectedVersion, status });
      if (response.success) { setResult(response.data); onSuccess?.(response.data); }
      else setError(translateError(response.error.code));
    } catch { setError(translateError("INTERNAL_ERROR")); }
    finally { setLoading(false); }
  }, [isLoading, onSuccess, translateError]);
  const reset = useCallback(() => { setError(null); setResult(null); }, []);
  return { changeStatus, isLoading, error, result, reset };
}
