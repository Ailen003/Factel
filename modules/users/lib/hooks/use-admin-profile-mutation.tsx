"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import {
  demoteOperatorToTrialUserAction,
  promoteUserToOperatorAction,
} from "../actions/admin-profile-mutation.actions";
import type { User } from "../types/user.types";

export type AdminProfileAction = "promoteOperator" | "demoteOperator";

export function useAdminProfileMutation(
  onSuccess: (
    action: AdminProfileAction,
    result: { revokedSessions: number },
  ) => void,
) {
  const t = useTranslations("users");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (
    action: AdminProfileAction,
    user: User,
    operationId: string,
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const input = {
        operationId,
        targetUserId: user.id,
        expectedVersion: user.adminProfileVersion,
        confirmed: true,
      } as const;
      const response = action === "promoteOperator"
        ? await promoteUserToOperatorAction(input)
        : await demoteOperatorToTrialUserAction(input);
      if (!response.success) {
        const key = `errors.${response.error.code}`;
        setError(t.has(key as never) ? t(key as never) : response.error.message);
        return;
      }
      onSuccess(action, response.data);
    } catch {
      setError(t("errors.INTERNAL_ERROR"));
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, t]);

  const reset = useCallback(() => setError(null), []);
  return { execute, isLoading, error, reset };
}
