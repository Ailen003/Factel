"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import {
  deleteUserAction,
  revokeUserSessionsAction,
  setUserStatusAction,
} from "../actions/user.actions";

export type UserAdminAction =
  | "activate"
  | "suspend"
  | "revokeSessions"
  | "delete";

export function useUserAdminAction(
  onSuccess: (action: UserAdminAction, revokedSessions: number) => void,
) {
  const t = useTranslations("users");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (action: UserAdminAction, userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = action === "activate"
        ? await setUserStatusAction(userId, "active")
        : action === "suspend"
          ? await setUserStatusAction(userId, "suspended")
          : action === "revokeSessions"
            ? await revokeUserSessionsAction(userId)
            : await deleteUserAction(userId);
      if (!response.success) {
        const key = `errors.${response.error.code}`;
        setError(t.has(key as never) ? t(key as never) : response.error.message);
        return;
      }
      onSuccess(action, response.data.revokedSessions);
    } catch {
      setError(t("errors.INTERNAL_ERROR"));
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, t]);

  const reset = useCallback(() => setError(null), []);

  return { execute, isLoading, error, reset };
}
