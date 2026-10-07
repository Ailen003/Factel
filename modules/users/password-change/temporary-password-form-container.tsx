"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/auth-client";
import { localizePath } from "@/lib/auth/route-access";
import { useChangeTemporaryPassword } from "../lib/hooks/use-change-temporary-password";
import {
  temporaryPasswordSchemaFactory,
  type TemporaryPasswordSchema,
} from "./schemas/temporary-password-schema";
import { TemporaryPasswordForm } from "./temporary-password-form";

export function TemporaryPasswordFormContainer() {
  const params = useParams();
  const locale = (params.locale as string) ?? "en";
  const t = useTranslations("temporaryPassword.validation");
  const { changePassword, isLoading, error } = useChangeTemporaryPassword();
  const form = useForm<TemporaryPasswordSchema>({
    resolver: zodResolver(temporaryPasswordSchemaFactory({
      currentPasswordRequired: t("currentPasswordRequired"),
      passwordLength: t("passwordLength"),
      passwordMustChange: t("passwordMustChange"),
      passwordMismatch: t("passwordMismatch"),
    })),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function signOut() {
    await authClient.signOut();
    window.location.assign(localizePath(locale, "/auth/login"));
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(changePassword)} noValidate>
        <TemporaryPasswordForm
          loading={isLoading}
          error={error}
          onSignOut={signOut}
        />
      </form>
    </FormProvider>
  );
}
