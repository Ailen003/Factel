"use client";

import QRCode from "react-qr-code";
import { Check, Clipboard, Loader2, LockKeyhole, RefreshCcw, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormContext } from "react-hook-form";
import { RHFPasswordField } from "@/components/form/rhf-components/rhf-password-field/rhf-password-field";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import { TotpCodeField } from "../components/totp-code-field";
import type { BackupCodesConfirmationFormValues, RegenerationFormValues } from "./schemas/setup-form-schemas";

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div aria-live="assertive">
      <AlertComponent title={error} variant="destructive" />
    </div>
  );
}

export function EnrollmentPasswordForm({ loading, error, onSignOut }: {
  loading: boolean;
  error: string | null;
  onSignOut: () => void;
}) {
  const t = useTranslations("twoFactor.setup");
  return (
    <fieldset disabled={loading} className="space-y-5">
      <FormError error={error} />
      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">{t("limitedTitle")}</p>
            <p className="text-muted-foreground">{t("limitedDescription")}</p>
          </div>
        </div>
      </div>
      <RHFPasswordField
        name="password"
        label={t("passwordLabel")}
        placeholder={t("passwordPlaceholder")}
        description={t("passwordDescription")}
        autoComplete="current-password"
        showPasswordLabel={t("showPassword")}
        hidePasswordLabel={t("hidePassword")}
      />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onSignOut}>{t("signOut")}</Button>
        <Button type="submit" className="sm:min-w-48">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{t("starting")}</> : t("start")}
        </Button>
      </div>
    </fieldset>
  );
}

export function EnrollmentVerificationForm({
  totpURI,
  manualSecret,
  loading,
  error,
  onCancel,
}: {
  totpURI: string;
  manualSecret: string | null;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  const t = useTranslations("twoFactor.setup");
  return (
    <fieldset disabled={loading} className="space-y-6">
      <FormError error={error} />
      <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
        <div className="mx-auto rounded-lg border bg-white p-4" role="img" aria-label={t("qrLabel")}>
          <QRCode value={totpURI} size={184} title={t("qrLabel")} />
        </div>
        <div className="space-y-3 text-sm">
          <h2 className="font-semibold">{t("scanTitle")}</h2>
          <p className="text-muted-foreground">{t("scanDescription")}</p>
          {manualSecret && (
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer font-medium">{t("manualToggle")}</summary>
              <p className="mt-2 text-muted-foreground">{t("manualDescription")}</p>
              <code className="mt-2 block break-all rounded bg-muted p-2 font-mono text-foreground" aria-label={t("manualSecretLabel")}>
                {manualSecret}
              </code>
            </details>
          )}
        </div>
      </div>
      <TotpCodeField
        name="code"
        label={t("verificationCodeLabel")}
        description={t("verificationCodeDescription")}
        disabled={loading}
        autoFocus
      />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>{t("cancelSetup")}</Button>
        <Button type="submit" className="sm:min-w-48">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{t("verifying")}</> : t("verify")}
        </Button>
      </div>
    </fieldset>
  );
}

export function BackupCodesForm({
  backupCodes,
  copied,
  loading,
  error,
  onCopy,
}: {
  backupCodes: readonly string[];
  copied: boolean;
  loading: boolean;
  error: string | null;
  onCopy: () => void;
}) {
  const t = useTranslations("twoFactor.backupCodes");
  const form = useFormContext<BackupCodesConfirmationFormValues>();
  return (
    <fieldset disabled={loading} className="space-y-5">
      <FormError error={error} />
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-semibold">{t("saveTitle")}</p>
        <p className="mt-1">{t("saveDescription")}</p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4" aria-label={t("listLabel")}>
        <ul className="grid gap-2 font-mono text-sm sm:grid-cols-2">
          {backupCodes.map((code) => <li key={code} className="select-all break-all rounded bg-background px-3 py-2">{code}</li>)}
        </ul>
      </div>
      <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onCopy}>
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Clipboard className="h-4 w-4" aria-hidden="true" />}
        {copied ? t("copied") : t("copy")}
      </Button>
      <div className="rounded-md border p-3">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-input accent-primary" {...form.register("saved")} />
          <span>{t("savedConfirmation")}</span>
        </label>
        {form.formState.errors.saved?.message && <p className="mt-2 text-sm text-destructive" role="alert">{form.formState.errors.saved.message}</p>}
      </div>
      <p className="text-sm text-muted-foreground">{t("lossWarning")}</p>
      <Button type="submit" className="w-full sm:ml-auto sm:w-auto">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{t("continuing")}</> : t("continue")}
      </Button>
    </fieldset>
  );
}

export function RegenerationForm({ loading, error, onSignOut }: {
  loading: boolean;
  error: string | null;
  onSignOut: () => void;
}) {
  const t = useTranslations("twoFactor.regeneration");
  const setupT = useTranslations("twoFactor.setup");
  const form = useFormContext<RegenerationFormValues>();
  return (
    <fieldset disabled={loading} className="space-y-5">
      <FormError error={error} />
      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div><p className="font-medium">{t("enabledTitle")}</p><p className="mt-1 text-muted-foreground">{t("enabledDescription")}</p></div>
        </div>
      </div>
      <RHFPasswordField
        name="password"
        label={t("passwordLabel")}
        placeholder={t("passwordPlaceholder")}
        autoComplete="current-password"
        showPasswordLabel={setupT("showPassword")}
        hidePasswordLabel={setupT("hidePassword")}
      />
      <div className="rounded-md border p-3">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-input accent-primary" {...form.register("confirmed")} />
          <span>{t("confirmation")}</span>
        </label>
        {form.formState.errors.confirmed?.message && <p className="mt-2 text-sm text-destructive" role="alert">{form.formState.errors.confirmed.message}</p>}
      </div>
      <p className="text-sm text-muted-foreground">{t("warning")}</p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onSignOut}>{setupT("signOut")}</Button>
        <Button type="submit" variant="destructive" className="sm:min-w-48">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{t("regenerating")}</> : <><RefreshCcw className="h-4 w-4" />{t("regenerate")}</>}
        </Button>
      </div>
    </fieldset>
  );
}
