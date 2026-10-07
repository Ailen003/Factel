"use client";

import { useCallback, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/auth-client";
import type { LoginSchema } from "../../form/schemas/login-schema";
import { getLoginDestination, type LoginResultData } from "../login-destination";

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const searchParams = useSearchParams();
  const t = useTranslations("loginForm");
  const locale = (params.locale as string) ?? "en";

  const login = useCallback(async (values: LoginSchema) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authClient.signIn.email(values);
      if (result.error) {
        setError(t("invalidCredentials"));
        return;
      }
      window.location.assign(
        getLoginDestination({
          data: result.data as LoginResultData | null,
          locale,
          returnTo: searchParams.get("returnTo"),
        }),
      );
    } catch {
      setError(t("invalidCredentials"));
    } finally {
      setIsLoading(false);
    }
  }, [locale, searchParams, t]);

  const reset = useCallback(() => setError(null), []);
  return { login, isLoading, error, reset };
}
