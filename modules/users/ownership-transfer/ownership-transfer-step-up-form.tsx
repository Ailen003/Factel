"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormContext } from "react-hook-form";
import { RHFTextField } from "@/components/form/rhf-components/rhf-text-field/rhf-text-field";
import { TotpCodeField } from "@/modules/two-factor/components/totp-code-field";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import type { OwnershipTransferFormSchema } from "./schemas/ownership-transfer-form-schema";

export type OwnershipTransferAction = "initiate" | "accept" | "decline" | "cancel";

export function OwnershipTransferStepUpForm({
  action,
  ownerName,
  targetName,
  loading,
  error,
  onCancel,
}: {
  action: OwnershipTransferAction;
  ownerName: string;
  targetName: string;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  const t = useTranslations("users.ownershipTransfer");
  const form = useFormContext<OwnershipTransferFormSchema>();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {error && <AlertComponent title={error} variant="destructive" />}

        <div className="grid gap-3 rounded-md border bg-muted/40 p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">{t("currentOwner")}</p>
            <p className="font-medium">{ownerName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("proposedOwner")}</p>
            <p className="font-medium">{targetName}</p>
          </div>
        </div>

        <div
          role="note"
          className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">{t(`${action}.warningTitle` as never)}</p>
            {action === "initiate" ? (
              <>
                <p>{t("initiate.noImmediateChange")}</p>
                <p>{t("initiate.expiryNotice")}</p>
              </>
            ) : action === "accept" ? (
              <>
                <p>{t("accept.sessionsWarning")}</p>
                <p>{t("accept.roleWarning")}</p>
                <p>{t("accept.irreversibleWarning")}</p>
              </>
            ) : (
              <p>{t(`${action}.terminalWarning` as never)}</p>
            )}
            <p>{t("noUrlTokens")}</p>
          </div>
        </div>

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
            <span>{t(`${action}.confirmationLabel`, { owner: ownerName, target: targetName })}</span>
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
          {t("close")}
        </Button>
        <Button
          type="submit"
          variant={action === "accept" || action === "initiate" ? "default" : "destructive"}
          disabled={loading}
          className="sm:min-w-48"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" />{t("submitting")}</>
            : t(`${action}.submit` as never)}
        </Button>
      </div>
    </div>
  );
}
