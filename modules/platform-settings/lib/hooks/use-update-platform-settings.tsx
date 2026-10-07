"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import {
  pauseAccessRequestsAction,
  resumeAccessRequestsAction,
  updatePlatformContactEmailAction,
} from "../actions/platform-settings.actions";

function usePlatformSettingsMutationError() {
  const t = useTranslations("platformSettings");
  const [error, setError] = useState<string | null>(null);
  const mapError = useCallback((code: string, message: string) => {
    const key = `errors.${code}`;
    setError(t.has(key as never) ? t(key as never) : message);
  }, [t]);
  const reset = useCallback(() => setError(null), []);
  return { error, mapError, reset };
}

export function useUpdatePlatformContactEmail(onSuccess: () => void) {
  const [isLoading, setIsLoading] = useState(false);
  const { error, mapError, reset } = usePlatformSettingsMutationError();
  const updateContact = useCallback(async (
    accessContactEmail: string,
    expectedVersion: number,
  ) => {
    setIsLoading(true);
    reset();
    try {
      const response = await updatePlatformContactEmailAction({
        accessContactEmail,
        expectedVersion,
      });
      if (!response.success) {
        mapError(response.error.code, response.error.message);
        return;
      }
      onSuccess();
    } catch {
      mapError("INTERNAL_ERROR", "INTERNAL_ERROR");
    } finally {
      setIsLoading(false);
    }
  }, [mapError, onSuccess, reset]);
  return { updateContact, isLoading, error, reset };
}

export function useSetPlatformAdmission(onSuccess: () => void) {
  const [isLoading, setIsLoading] = useState(false);
  const { error, mapError, reset } = usePlatformSettingsMutationError();
  const setAdmission = useCallback(async (
    enabled: boolean,
    expectedVersion: number,
  ) => {
    setIsLoading(true);
    reset();
    try {
      const response = enabled
        ? await resumeAccessRequestsAction({ expectedVersion })
        : await pauseAccessRequestsAction({ expectedVersion });
      if (!response.success) {
        mapError(response.error.code, response.error.message);
        return;
      }
      onSuccess();
    } catch {
      mapError("INTERNAL_ERROR", "INTERNAL_ERROR");
    } finally {
      setIsLoading(false);
    }
  }, [mapError, onSuccess, reset]);
  return { setAdmission, isLoading, error, reset };
}
