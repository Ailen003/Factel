"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import type { EditServiceRequestSchema } from "../../form/edit/schemas/edit-service-request-schema";
import { editServiceRequestAction } from "../actions/service-request.actions";
import type { ServiceRequest } from "../types/service-request.types";

export function useEditServiceRequest(onSuccess?: (request: ServiceRequest) => void) {
  const t = useTranslations("requests");
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ServiceRequest | null>(null);
  const translateError = useCallback((code: string) => {
    const key = `errors.${code}`;
    return t.has(key as never) ? t(key as never) : t("errors.INTERNAL_ERROR");
  }, [t]);
  const save = useCallback(async (id: string, expectedVersion: number, values: EditServiceRequestSchema) => {
    if (isLoading) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const response = await editServiceRequestAction({ id, expectedVersion, request: values });
      if (response.success) { setResult(response.data); onSuccess?.(response.data); }
      else setError(translateError(response.error.code));
    } catch { setError(translateError("INTERNAL_ERROR")); }
    finally { setLoading(false); }
  }, [isLoading, onSuccess, translateError]);
  const reset = useCallback(() => { setError(null); setResult(null); }, []);
  return { save, isLoading, error, result, reset };
}
