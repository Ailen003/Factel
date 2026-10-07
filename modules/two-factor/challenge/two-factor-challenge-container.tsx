"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormProvider, useForm } from "react-hook-form";
import { authClient } from "@/lib/auth/auth-client";
import { getSafeReturnTo, localizePath } from "@/lib/auth/route-access";
import { useTwoFactorMutation } from "../hooks/use-two-factor-mutation";
import {
  verifyTwoFactorBackupChallengeAction,
  verifyTwoFactorTotpChallengeAction,
} from "../lib/actions/two-factor.actions";
import {
  createBackupChallengeSchema,
  createTotpChallengeSchema,
  type BackupChallengeFormValues,
  type TotpChallengeFormValues,
} from "./schemas/challenge-form-schemas";
import { BackupChallengeForm, TotpChallengeForm } from "./challenge-presentational";

export function TwoFactorChallengeContainer() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params.locale as string) ?? "en";
  const tValidation = useTranslations("twoFactor.validation");
  const { execute, isLoading, error, resetError } = useTwoFactorMutation();
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"), "platform_admin");
  const totpForm = useForm<TotpChallengeFormValues>({
    resolver: zodResolver(createTotpChallengeSchema({ invalidTotp: tValidation("invalidTotp") })),
    defaultValues: { code: "" },
  });
  const backupForm = useForm<BackupChallengeFormValues>({
    resolver: zodResolver(createBackupChallengeSchema({ backupCodeRequired: tValidation("backupCodeRequired") })),
    defaultValues: { code: "" },
  });

  async function verifyTotp(values: TotpChallengeFormValues) {
    const data = await execute(() => verifyTwoFactorTotpChallengeAction({ code: values.code, returnTo }));
    totpForm.resetField("code");
    if (data) {
      router.push(localizePath(locale, getSafeReturnTo(data.returnTo, "platform_admin")));
      router.refresh();
    } else {
      totpForm.setFocus("code");
    }
  }

  async function verifyBackup(values: BackupChallengeFormValues) {
    const data = await execute(() => verifyTwoFactorBackupChallengeAction({ code: values.code, returnTo }));
    backupForm.resetField("code");
    if (data) {
      router.push(localizePath(locale, getSafeReturnTo(data.returnTo, "platform_admin")));
      router.refresh();
    } else {
      backupForm.setFocus("code");
    }
  }

  function switchMode() {
    resetError();
    totpForm.reset();
    backupForm.reset();
    setMode((current) => current === "totp" ? "backup" : "totp");
  }

  async function leaveChallenge(destination: "/auth/login") {
    totpForm.reset();
    backupForm.reset();
    await authClient.signOut();
    const search = new URLSearchParams({ returnTo });
    router.push(`${localizePath(locale, destination)}?${search.toString()}`);
    router.refresh();
  }

  const sharedProps = {
    loading: isLoading,
    error,
    onSwitchMode: switchMode,
    onRestart: () => void leaveChallenge("/auth/login"),
    onSignOut: () => void leaveChallenge("/auth/login"),
  };

  if (mode === "backup") {
    return (
      <FormProvider {...backupForm}>
        <form onSubmit={backupForm.handleSubmit(verifyBackup)} noValidate>
          <BackupChallengeForm {...sharedProps} />
        </form>
      </FormProvider>
    );
  }

  return (
    <FormProvider {...totpForm}>
      <form onSubmit={totpForm.handleSubmit(verifyTotp)} noValidate>
        <TotpChallengeForm {...sharedProps} />
      </form>
    </FormProvider>
  );
}
