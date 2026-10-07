"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { editUserAction } from "../actions/user.actions";
import { convertEditUserDto } from "../types/user.types";
import type { EditUserSchema } from "../../form/edit/schemas/edit-user-schema";

export function useEditUser(onSuccess: () => void) {
  const t = useTranslations("users");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editUser = useCallback(async (userId: string, values: EditUserSchema) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await editUserAction(userId, convertEditUserDto(values));
      if (!response.success) {
        const key = `errors.${response.error.code}`;
        setError(t.has(key as never) ? t(key as never) : response.error.message);
        return;
      }
      onSuccess();
    } catch {
      setError(t("errors.INTERNAL_ERROR"));
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, t]);
  return { editUser, isLoading, error };
}
