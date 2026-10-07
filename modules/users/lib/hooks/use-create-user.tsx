"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { createUserAction } from "../actions/user.actions";
import {
  convertCreateUserDto,
  type ProvisionedTrialUser,
} from "../types/user.types";
import type { CreateUserSchema } from "../../form/create/schemas/create-user-schema";

export function useCreateUser(onSuccess: (result: ProvisionedTrialUser) => void) {
  const t = useTranslations("users");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createUser = useCallback(async (values: CreateUserSchema) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await createUserAction(convertCreateUserDto(values));
      if (!response.success) {
        const key = `errors.${response.error.code}`;
        setError(t.has(key as never) ? t(key as never) : response.error.message);
        return;
      }
      onSuccess(response.data);
    } catch {
      setError(t("errors.INTERNAL_ERROR"));
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, t]);
  return { createUser, isLoading, error };
}
