"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { TwoFactorActionResult } from "../lib/types";

export function useTwoFactorMutation() {
  const t = useTranslations("twoFactor.errors");
  const inFlight = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async <T,>(operation: () => Promise<TwoFactorActionResult<T>>) => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const response = await operation();
      if (!response.success) {
        const code = response.error.code;
        setError(t.has(code as never) ? t(code as never) : t("INTERNAL_ERROR"));
        return null;
      }
      return response.data;
    } catch {
      setError(t("INTERNAL_ERROR"));
      return null;
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }, [t]);

  const resetError = useCallback(() => setError(null), []);
  return { execute, isLoading, error, resetError };
}
