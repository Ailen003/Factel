"use client";

import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormContext } from "react-hook-form";
import { RHFSelectField } from "@/components/form/rhf-components/rhf-select-field/rhf-select-field";
import { RHFTextField } from "@/components/form/rhf-components/rhf-text-field/rhf-text-field";
import { TotpCodeField } from "@/modules/two-factor/components/totp-code-field";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import type { User } from "../lib/types/user.types";
import type { OperatorMfaRecoveryFormSchema } from "./schemas/operator-mfa-recovery-form-schema";

export function OperatorMfaRecoveryForm({
  user,
  loading,
  error,
  onCancel,
}: {
  user: User;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  const t = useTranslations("users.mfaRecovery");
  const form = useFormContext<OperatorMfaRecoveryFormSchema>();
  const reasons = [
    "lost_all_factors",
    "lost_device",
    "suspected_compromise",
    "operational_recovery",
    "other",
  ].map((value) => ({ value, label: t(`reasons.${value}` as never) }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {error && <AlertComponent title={error} variant="destructive" />}

        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium">{user.fullName}</p>
          <p className="text-muted-foreground">{t("targetSummary")}</p>
        </div>

        <div
          role="note"
          className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">{t("warningTitle")}</p>
            <p>{t("sessionsWarning")}</p>
            <p>{t("enrollmentWarning")}</p>
            <p>{t(user.status === "suspended" ? "suspensionWarning" : "activeWarning")}</p>
            <p>{t("noSecretsWarning")}</p>
          </div>
        </div>

        <RHFSelectField
          name="reason"
          label={t("reasonLabel")}
          description={t("reasonDescription")}
          options={reasons}
          disabled={loading}
          fullWidth
        />
        <RHFTextField
          name="operationalReference"
          label={t("referenceLabel")}
          placeholder={t("referencePlaceholder")}
          description={t("referenceDescription")}
          maxLength={120}
          disabled={loading}
          fullWidth
        />
        <RHFTextField
          name="password"
          label={t("passwordLabel")}
          description={t("passwordDescription")}
          type="password"
          disabled={loading}
          fullWidth
        />
        <TotpCodeField
          name="totpCode"
          label={t("totpLabel")}
          description={t("totpDescription")}
          disabled={loading}
        />

        <div className="rounded-md border p-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              disabled={loading}
              {...form.register("confirmed")}
            />
            <span>{t("confirmationLabel", { name: user.fullName })}</span>
          </label>
          {form.formState.errors.confirmed?.message && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {form.formState.errors.confirmed.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t bg-background px-6 py-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          {t("cancel")}
        </Button>
        <Button type="submit" variant="destructive" disabled={loading} className="sm:min-w-48">
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" />{t("submitting")}</>
            : <><KeyRound className="h-4 w-4" />{t("submit")}</>}
        </Button>
      </div>
    </div>
  );
}
