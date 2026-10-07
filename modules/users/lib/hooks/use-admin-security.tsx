"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import {
  acceptOwnershipTransferAction,
  cancelOwnershipTransferAction,
  declineOwnershipTransferAction,
  getCurrentOwnershipTransferAction,
  initiateOwnershipTransferAction,
  recoverOperatorMfaAction,
} from "../actions/admin-security.actions";
import type {
  InitiateOwnershipTransferDto,
  OperatorMfaRecoveryDto,
  OperatorMfaRecoveryResult,
  OwnershipTransferMutationResult,
  OwnershipTransferView,
  ResolveOwnershipTransferDto,
} from "../types/admin-security.types";

type TransferResolution = "cancel" | "decline" | "accept";

export function useAdminSecurity() {
  const t = useTranslations("users");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryResult, setRecoveryResult] = useState<OperatorMfaRecoveryResult | null>(null);
  const [transferResult, setTransferResult] = useState<OwnershipTransferMutationResult | null>(null);
  const [currentTransfer, setCurrentTransfer] = useState<OwnershipTransferView | null>(null);

  const translateError = useCallback((code: string, message: string) => {
    const key = `errors.${code}`;
    return t.has(key as never) ? t(key as never) : message;
  }, [t]);

  const run = useCallback(async <T,>(
    operation: () => Promise<{ success: true; data: T } | { success: false; error: { code: string; message: string } }>,
    onSuccess: (data: T) => void,
  ) => {
    if (isLoading) return false;
    setIsLoading(true);
    setError(null);
    try {
      const response = await operation();
      if (!response.success) {
        setError(translateError(response.error.code, response.error.message));
        return false;
      }
      onSuccess(response.data);
      return true;
    } catch {
      setError(t("errors.INTERNAL_ERROR"));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, t, translateError]);

  const recoverOperator = useCallback((input: OperatorMfaRecoveryDto) =>
    run(() => recoverOperatorMfaAction(input), setRecoveryResult), [run]);

  const initiateTransfer = useCallback((input: InitiateOwnershipTransferDto) =>
    run(() => initiateOwnershipTransferAction(input), (result) => {
      setTransferResult(result);
      setCurrentTransfer(result.transfer);
    }), [run]);

  const resolveTransfer = useCallback((resolution: TransferResolution, input: ResolveOwnershipTransferDto) =>
    run(
      () => resolution === "accept" ? acceptOwnershipTransferAction(input)
        : resolution === "decline" ? declineOwnershipTransferAction(input)
        : cancelOwnershipTransferAction(input),
      (result) => {
        setTransferResult(result);
        setCurrentTransfer(result.transfer);
      },
    ), [run]);

  const refreshTransfer = useCallback(() => run(
    () => getCurrentOwnershipTransferAction(),
    setCurrentTransfer,
  ), [run]);

  const reset = useCallback(() => {
    setError(null);
    setRecoveryResult(null);
    setTransferResult(null);
  }, []);

  return {
    recoverOperator,
    initiateTransfer,
    resolveTransfer,
    refreshTransfer,
    isLoading,
    error,
    recoveryResult,
    transferResult,
    currentTransfer,
    reset,
  };
}
