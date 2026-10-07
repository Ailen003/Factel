"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormContext, useWatch } from "react-hook-form";
import { RHFSelectField } from "@/components/form/rhf-components/rhf-select-field/rhf-select-field";
import { RHFTextField } from "@/components/form/rhf-components/rhf-text-field/rhf-text-field";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import type { User } from "../lib/types/user.types";
import type { CredentialReissueFormSchema } from "./schemas/credential-reissue-form-schema";

export function CredentialReissueForm({
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
  const t = useTranslations("users.credentialReissue");
  const form = useFormContext<CredentialReissueFormSchema>();
  const reason = useWatch({ control: form.control, name: "reason" });
  const purpose = user.trialActivatedAt === null ? "activation" : "recovery";
  const reasons = [
    "expired_credential",
    "forgotten_password",
    "suspected_compromise",
    "failure_recovery",
    "other",
  ].map((value) => ({ value, label: t(`reasons.${value}` as never) }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {error && <AlertComponent title={error} variant="destructive" />}

        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium">{user.fullName}</p>
          <p className="break-all text-muted-foreground">{user.email}</p>
          <p className="mt-2 text-muted-foreground">{t(`purpose.${purpose}`)}</p>
        </div>

        {user.status === "suspended" && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">{t("suspendedTitle")}</p>
              <p className="mt-1 text-sm">{t("suspendedWarning")}</p>
            </div>
          </div>
        )}

        <RHFSelectField
          name="reason"
          label={t("reasonLabel")}
          description={t("reasonDescription")}
          options={reasons}
          fullWidth
        />

        {reason === "other" && (
          <RHFTextField
            name="reasonNote"
            label={t("otherNoteLabel")}
            placeholder={t("otherNotePlaceholder")}
            description={t("otherNoteDescription")}
            maxLength={200}
            fullWidth
          />
        )}

        <div className="rounded-md border p-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              disabled={loading}
              {...form.register("confirmed")}
            />
            <span>{t("confirmationLabel")}</span>
          </label>
          {form.formState.errors.confirmed?.message && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {form.formState.errors.confirmed.message}
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{t("securityNotice")}</p>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t bg-background px-6 py-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={loading} className="sm:min-w-48">
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" />{t("issuing")}</>
          ) : t(`submit.${purpose}`)}
        </Button>
      </div>
    </div>
  );
}
