"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { prepareClientCreationAction, confirmClientCreationAction } from "../actions/client.actions";
import { convertCreateClientDto, type ClientCreationPreview, type ClientCreationResult, type CreateClientDto } from "../types/client.types";

export function useCreateClient({ onSuccess, onLockChange }: {
  onSuccess?: (result: ClientCreationResult) => void;
  onLockChange?: (locked: boolean) => void;
} = {}) {
  const t = useTranslations("clients");
  const [preview, setPreview] = useState<ClientCreationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [expired, setExpired] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [result, setResult] = useState<ClientCreationResult | null>(null);
  const busy = useRef(false);
  const locked = useRef(false);
  const generation = useRef(0);
  const committed = useRef(false);
  const retryAcknowledgment = useRef(false);
  const translateError = useCallback((code: string) => t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.INTERNAL_ERROR"), [t]);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    if (!preview) return;
    const delay = Math.max(0, new Date(preview.expiresAt).getTime() - Date.now());
    const timer = setTimeout(() => setExpired(true), delay);
    return () => clearTimeout(timer);
  }, [preview]);

  const reset = useCallback(() => {
    if (locked.current || committed.current) return;
    generation.current++;
    busy.current = false;
    setPreview(null);
    setError(null);
    setLoading(false);
    setExpired(false);
    setAcknowledged(false);
    setResult(null);
  }, []);
  const prepare = useCallback(async (values: CreateClientDto) => {
    if (busy.current || locked.current || committed.current) return;
    const current = ++generation.current;
    busy.current = true;
    setLoading(true);
    setError(null);
    setPreview(null);
    setExpired(false);
    setAcknowledged(false);
    try {
      const response = await prepareClientCreationAction(convertCreateClientDto(values));
      if (current !== generation.current) return;
      if (response.success) setPreview(response.data);
      else setError(translateError(response.error.code));
    } catch {
      if (current === generation.current) setError(translateError("INTERNAL_ERROR"));
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [translateError]);
  const acknowledge = useCallback((value: boolean) => {
    if (!busy.current && !locked.current) setAcknowledged(value);
  }, []);
  const confirm = useCallback(async () => {
    if (!preview || busy.current || committed.current || (!uncertain && (expired || (preview.duplicates.length > 0 && !acknowledged)))) return;
    if (!uncertain) retryAcknowledgment.current = acknowledged;
    busy.current = true;
    locked.current = true;
    onLockChange?.(true);
    setLoading(true);
    setError(null);
    const current = generation.current;
    try {
      const response = await confirmClientCreationAction({
        planId: preview.planId,
        planHash: preview.planHash,
        acknowledgeDuplicates: retryAcknowledgment.current,
      });
      if (current !== generation.current) return;
      if (response.success) {
        committed.current = true;
        locked.current = false;
        setUncertain(false);
        setResult(response.data);
        onLockChange?.(false);
        onSuccess?.(response.data);
      } else {
        // Unknown failures may have happened after the transaction committed.
        const definitiveRejection = ["PLAN_STALE", "PLAN_EXPIRED", "DUPLICATES_CHANGED", "DUPLICATE_ACKNOWLEDGMENT_REQUIRED"].includes(response.error.code);
        const preflightRejection = ["VALIDATION_ERROR", "UNAUTHENTICATED", "ACCOUNT_INACTIVE", "FORBIDDEN", "NOT_FOUND", "SENSITIVE_DATA"].includes(response.error.code);
        // A failed access check on a retry cannot settle an earlier lost response.
        const safeFailure = definitiveRejection || (!uncertain && preflightRejection);
        locked.current = !safeFailure;
        setUncertain(!safeFailure);
        onLockChange?.(!safeFailure);
        if (["PLAN_STALE", "PLAN_EXPIRED", "DUPLICATES_CHANGED"].includes(response.error.code)) setExpired(true);
        if (uncertain && response.error.code === "UNAUTHENTICATED") {
          setError(translateError("CONFIRMATION_REAUTHENTICATE"));
        } else if (uncertain && preflightRejection) {
          setError(`${translateError(response.error.code)} ${translateError("CONFIRMATION_UNCERTAIN")}`);
        } else {
          setError(translateError(safeFailure ? response.error.code : "CONFIRMATION_UNCERTAIN"));
        }
      }
    } catch {
      if (current === generation.current) {
        setUncertain(true);
        setError(translateError("CONFIRMATION_UNCERTAIN"));
      }
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [preview, uncertain, expired, acknowledged, onLockChange, onSuccess, translateError]);
  return { prepare, confirm, preview, error, isLoading, uncertain, expired, acknowledged, acknowledge, result, reset };
}
