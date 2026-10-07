"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import {
  confirmTemporaryCredentialDeliveryAction,
  reissueTemporaryCredentialAction,
} from "../actions/temporary-credential-reissue.actions";
import type {
  ConfirmTemporaryCredentialDeliveryDto,
  ReissuedTemporaryCredentialResult,
  ReissueTemporaryCredentialDto,
  TemporaryCredentialDeliveryResult,
} from "../types/temporary-credential-reissue.types";

export function useTemporaryCredentialReissue() {
  const t = useTranslations("users");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReissuedTemporaryCredentialResult | null>(null);
  const [deliveryResult, setDeliveryResult] =
    useState<TemporaryCredentialDeliveryResult | null>(null);

  const translateError = useCallback((code: string, message: string) => {
    const key = `errors.${code}`;
    return t.has(key as never) ? t(key as never) : message;
  }, [t]);

  const reissue = useCallback(async (input: ReissueTemporaryCredentialDto) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await reissueTemporaryCredentialAction(input);
      if (!response.success) {
        setError(translateError(response.error.code, response.error.message));
        return;
      }
      setResult(response.data);
    } catch {
      setError(t("errors.INTERNAL_ERROR"));
    } finally {
      setIsLoading(false);
    }
  }, [t, translateError]);

  const confirmDelivery = useCallback(async (
    input: ConfirmTemporaryCredentialDeliveryDto,
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await confirmTemporaryCredentialDeliveryAction(input);
      if (!response.success) {
        setError(translateError(response.error.code, response.error.message));
        return;
      }
      setDeliveryResult(response.data);
      setResult((current) => current
        ? { ...current, issuance: response.data.issuance }
        : current);
    } catch {
      setError(t("errors.INTERNAL_ERROR"));
    } finally {
      setIsLoading(false);
    }
  }, [t, translateError]);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
    setDeliveryResult(null);
    setIsLoading(false);
  }, []);

  return { reissue, confirmDelivery, isLoading, error, result, deliveryResult, reset };
}
