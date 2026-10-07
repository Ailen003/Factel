"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { createLoginSchema, type LoginSchema } from "./schemas/login-schema";
import { useLogin } from "../lib/hooks/use-login";
import LoginForm from "./login-form";

export default function LoginFormContainer() {
  const t = useTranslations("loginForm");
  const { login, isLoading, error } = useLogin();
  const schema = createLoginSchema({
    invalidEmail: t("invalidEmail"),
    passwordRequired: t("passwordRequired"),
  });
  const form = useForm<LoginSchema>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(login)}
        className="flex h-full w-full items-center justify-center"
      >
        <LoginForm loading={isLoading} error={error} />
      </form>
    </FormProvider>
  );
}
