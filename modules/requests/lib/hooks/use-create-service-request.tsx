"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { confirmServiceRequestCreationAction, prepareServiceRequestCreationAction } from "../actions/service-request.actions";
import { convertCreateServiceRequestDto, type CreateServiceRequestDto, type ServiceRequestCreationPreview, type ServiceRequestCreationResult } from "../types/service-request.types";

export function useCreateServiceRequest({ onSuccess, onLockChange }: {
  onSuccess?: (result: ServiceRequestCreationResult) => void; onLockChange?: (locked: boolean) => void;
} = {}) {
  const t = useTranslations("requests");
  const [preview, setPreview] = useState<ServiceRequestCreationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [expired, setExpired] = useState(false);
  const busy = useRef(false); const locked = useRef(false); const generation = useRef(0); const committed = useRef(false);
  const translate = useCallback((code: string) => t.has(`errors.${code}` as never) ? t(`errors.${code}` as never) : t("errors.INTERNAL_ERROR"), [t]);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => { if (!preview) return; const delay = Math.max(0, new Date(preview.expiresAt).getTime() - Date.now());
    const timer = window.setTimeout(() => setExpired(true), delay); return () => window.clearTimeout(timer); }, [preview]);
  const reset = useCallback(() => { if (locked.current || committed.current) return; generation.current++; busy.current = false;
    setPreview(null); setError(null); setLoading(false); setUncertain(false); setExpired(false); }, []);
  const prepare = useCallback(async (values: CreateServiceRequestDto) => {
    if (busy.current || locked.current || committed.current) return;
    const current = ++generation.current; busy.current = true; setLoading(true); setError(null); setPreview(null); setExpired(false);
    try { const response = await prepareServiceRequestCreationAction(convertCreateServiceRequestDto(values));
      if (current !== generation.current) return;
      if (response.success) setPreview(response.data); else setError(translate(response.error.code));
    } catch { if (current === generation.current) setError(translate("INTERNAL_ERROR")); }
    finally { if (current === generation.current) { busy.current = false; setLoading(false); } }
  }, [translate]);
  const confirm = useCallback(async () => {
    if (!preview || busy.current || committed.current || (!uncertain && expired)) return;
    busy.current = true; locked.current = true; onLockChange?.(true); setLoading(true); setError(null);
    const current = generation.current;
    try { const response = await confirmServiceRequestCreationAction({ planId: preview.planId, planHash: preview.planHash });
      if (current !== generation.current) return;
      if (response.success) { committed.current = true; locked.current = false; setUncertain(false); onLockChange?.(false); onSuccess?.(response.data); }
      else {
        const definitive = ["PLAN_STALE", "PLAN_EXPIRED", "CLIENT_CHANGED"].includes(response.error.code);
        const preflight = ["VALIDATION_ERROR", "UNAUTHENTICATED", "ACCOUNT_INACTIVE", "FORBIDDEN", "NOT_FOUND", "SENSITIVE_DATA"].includes(response.error.code);
        const safe = definitive || (!uncertain && preflight); locked.current = !safe; setUncertain(!safe); onLockChange?.(!safe);
        if (definitive) setExpired(true);
        setError(translate(safe ? response.error.code : "CONFIRMATION_UNCERTAIN"));
      }
    } catch { if (current === generation.current) { setUncertain(true); setError(translate("CONFIRMATION_UNCERTAIN")); } }
    finally { if (current === generation.current) { busy.current = false; setLoading(false); } }
  }, [expired, onLockChange, onSuccess, preview, translate, uncertain]);
  return { preview, error, isLoading, uncertain, expired, prepare, confirm, reset };
}
