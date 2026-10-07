"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getClientByIdAction } from "../actions/client.actions";
import type { ClientDetails } from "../types/client.types";

export function useClient({ clientId }: { clientId: string }) {
  const t = useTranslations("clients");
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const getClient = useCallback(async () => {
    const version = ++request.current;
    setLoading(true); setError(null); setClient(null);
    try {
      const response = await getClientByIdAction(clientId);
      if (version !== request.current) return;
      if (response.success) setClient(response.data);
      else setError(t.has(`errors.${response.error.code}`) ? t(`errors.${response.error.code}`) : t("errors.INTERNAL_ERROR"));
    } catch {
      if (version === request.current) setError(t("errors.INTERNAL_ERROR"));
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, [clientId, t]);
  const reset = useCallback(() => { request.current++; setClient(null); setError(null); setLoading(false); }, []);
  useEffect(() => {
    const activeRequest = request;
    const timer = setTimeout(() => { void getClient(); }, 0);
    return () => { clearTimeout(timer); activeRequest.current++; };
  }, [getClient]);
  return { client, isLoading, error, getClient, reset };
}
