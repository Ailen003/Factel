"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getServiceRequestByIdAction } from "../actions/service-request.actions";
import type { ServiceRequestDetails } from "../types/service-request.types";

export function useServiceRequest({ requestId }: { requestId: string }) {
  const t = useTranslations("requests");
  const [request, setRequest] = useState<ServiceRequestDetails | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current; setLoading(true); setError(null); setRequest(null);
    try {
      const response = await getServiceRequestByIdAction(requestId);
      if (current !== generation.current) return;
      if (response.success) setRequest(response.data);
      else setError(t.has(`errors.${response.error.code}` as never) ? t(`errors.${response.error.code}` as never) : t("errors.INTERNAL_ERROR"));
    } catch { if (current === generation.current) setError(t("errors.INTERNAL_ERROR")); }
    finally { if (current === generation.current) setLoading(false); }
  }, [requestId, t]);
  useEffect(() => { const activeRequest = generation; const timer = window.setTimeout(() => void load(), 0);
    return () => { window.clearTimeout(timer); activeRequest.current++; }; }, [load]);
  return { request, isLoading, error, load };
}
