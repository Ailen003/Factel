"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { authClient } from "@/lib/auth/auth-client";
import { localizePath } from "@/lib/auth/route-access";
import {
  beginTwoFactorEnrollmentAction,
  regenerateTwoFactorBackupCodesAction,
  verifyTwoFactorEnrollmentAction,
} from "../lib/actions/two-factor.actions";
import type { TwoFactorEnrollmentData } from "../lib/types";
import { useTwoFactorMutation } from "../hooks/use-two-factor-mutation";
import {
  createBackupCodesConfirmationSchema,
  createEnrollmentPasswordSchema,
  createEnrollmentVerificationSchema,
  createRegenerationSchema,
  type BackupCodesConfirmationFormValues,
  type EnrollmentPasswordFormValues,
  type EnrollmentVerificationFormValues,
  type RegenerationFormValues,
} from "./schemas/setup-form-schemas";
import {
  BackupCodesForm,
  EnrollmentPasswordForm,
  EnrollmentVerificationForm,
  RegenerationForm,
} from "./setup-presentational";
import { getManualTotpSecret } from "./totp-uri";

type SetupStage =
  | { kind: "begin" }
  | { kind: "verify"; enrollment: TwoFactorEnrollmentData }
  | { kind: "regenerate" }
  | { kind: "backup-codes"; backupCodes: string[] };

export function TwoFactorSetupContainer({
  initialStatus,
  returnTo,
}: {
  initialStatus: "enrollment-required" | "enabled";
  returnTo: string;
}) {
  const params = useParams();
  const router = useRouter();
  const locale = (params.locale as string) ?? "en";
  const tValidation = useTranslations("twoFactor.validation");
  const { execute, isLoading, error, resetError } = useTwoFactorMutation();
  const [stage, setStage] = useState<SetupStage>(() =>
    initialStatus === "enabled" ? { kind: "regenerate" } : { kind: "begin" },
  );
  const [copied, setCopied] = useState(false);

  const passwordForm = useForm<EnrollmentPasswordFormValues>({
    resolver: zodResolver(createEnrollmentPasswordSchema({ passwordRequired: tValidation("passwordRequired") })),
    defaultValues: { password: "" },
  });
  const verificationForm = useForm<EnrollmentVerificationFormValues>({
    resolver: zodResolver(createEnrollmentVerificationSchema({ invalidTotp: tValidation("invalidTotp") })),
    defaultValues: { code: "" },
  });
  const backupForm = useForm<BackupCodesConfirmationFormValues>({
    resolver: zodResolver(createBackupCodesConfirmationSchema({ confirmationRequired: tValidation("savedConfirmationRequired") })),
    defaultValues: { saved: false },
  });
  const regenerationForm = useForm<RegenerationFormValues>({
    resolver: zodResolver(createRegenerationSchema({
      passwordRequired: tValidation("passwordRequired"),
      confirmationRequired: tValidation("regenerationConfirmationRequired"),
    })),
    defaultValues: { password: "", confirmed: false },
  });
  const backupSaved = useWatch({ control: backupForm.control, name: "saved" });

  useEffect(() => {
    if (stage.kind !== "backup-codes" || backupSaved) return;
    const preventLoss = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [backupSaved, stage.kind]);

  async function signOut() {
    setStage({ kind: "begin" });
    await authClient.signOut();
    router.push(localizePath(locale, "/auth/login"));
    router.refresh();
  }

  async function begin(values: EnrollmentPasswordFormValues) {
    const data = await execute(() => beginTwoFactorEnrollmentAction(values));
    passwordForm.resetField("password");
    if (data) {
      setStage({ kind: "verify", enrollment: data });
    } else {
      passwordForm.setFocus("password");
    }
  }

  async function verify(values: EnrollmentVerificationFormValues) {
    if (stage.kind !== "verify") return;
    const backupCodes = stage.enrollment.backupCodes;
    const data = await execute(() => verifyTwoFactorEnrollmentAction(values));
    verificationForm.resetField("code");
    if (data) {
      setCopied(false);
      backupForm.reset({ saved: false });
      setStage({ kind: "backup-codes", backupCodes });
    } else {
      verificationForm.setFocus("code");
    }
  }

  async function regenerate(values: RegenerationFormValues) {
    const data = await execute(() => regenerateTwoFactorBackupCodesAction({
      password: values.password,
      confirmed: true,
    }));
    regenerationForm.reset({ password: "", confirmed: false });
    if (data) {
      setCopied(false);
      backupForm.reset({ saved: false });
      setStage({ kind: "backup-codes", backupCodes: data.backupCodes });
    } else {
      regenerationForm.setFocus("password");
    }
  }

  async function copyBackupCodes() {
    if (stage.kind !== "backup-codes") return;
    try {
      await navigator.clipboard.writeText(stage.backupCodes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function finishBackupCodes() {
    setStage(initialStatus === "enabled" ? { kind: "regenerate" } : { kind: "begin" });
    router.push(localizePath(locale, returnTo));
    router.refresh();
  }

  if (stage.kind === "verify") {
    return (
      <FormProvider {...verificationForm}>
        <form onSubmit={verificationForm.handleSubmit(verify)} noValidate>
          <EnrollmentVerificationForm
            totpURI={stage.enrollment.totpURI}
            manualSecret={stage.enrollment.manualSecret || getManualTotpSecret(stage.enrollment.totpURI)}
            loading={isLoading}
            error={error}
            onCancel={() => {
              resetError();
              verificationForm.reset();
              setStage({ kind: "begin" });
            }}
          />
        </form>
      </FormProvider>
    );
  }

  if (stage.kind === "backup-codes") {
    return (
      <FormProvider {...backupForm}>
        <form onSubmit={backupForm.handleSubmit(finishBackupCodes)} noValidate>
          <BackupCodesForm
            backupCodes={stage.backupCodes}
            copied={copied}
            loading={false}
            error={error}
            onCopy={copyBackupCodes}
          />
        </form>
      </FormProvider>
    );
  }

  if (stage.kind === "regenerate") {
    return (
      <FormProvider {...regenerationForm}>
        <form onSubmit={regenerationForm.handleSubmit(regenerate)} noValidate>
          <RegenerationForm loading={isLoading} error={error} onSignOut={signOut} />
        </form>
      </FormProvider>
    );
  }

  return (
    <FormProvider {...passwordForm}>
      <form onSubmit={passwordForm.handleSubmit(begin)} noValidate>
        <EnrollmentPasswordForm loading={isLoading} error={error} onSignOut={signOut} />
      </form>
    </FormProvider>
  );
}
