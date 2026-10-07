"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { localizePath } from "@/lib/auth/route-access";
import { changeTemporaryPasswordAction } from "../actions/temporary-password.actions";
import type { TemporaryPasswordSchema } from "../../password-change/schemas/temporary-password-schema";

export function useChangeTemporaryPassword() {
  const params = useParams();
  const locale = (params.locale as string) ?? "en";
  const t = useTranslations("temporaryPassword.errors");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changePassword = useCallback(async (values: TemporaryPasswordSchema) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await changeTemporaryPasswordAction(values);
      if (!response.success) {
        const key = response.error.code;
        setError(t.has(key as never) ? t(key as never) : t("INTERNAL_ERROR"));
        return;
      }
      window.location.assign(localizePath(locale, "/dashboard"));
    } catch {
      setError(t("INTERNAL_ERROR"));
    } finally {
      setIsLoading(false);
    }
  }, [locale, t]);

  return { changePassword, isLoading, error };
}
