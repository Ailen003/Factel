"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { RHFTextField } from "@/components/form/rhf-components/rhf-text-field/rhf-text-field";
import { RHFNumberField } from "@/components/form/rhf-components/rhf-number-field/rhf-number-field";
import { RHFSelectField } from "@/components/form/rhf-components/rhf-select-field/rhf-select-field";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";

export default function CreateUserForm({ loading, error, onCancel }: {
  loading: boolean;
  error: string | null;
  onCancel?: () => void;
}) {
  const t = useTranslations("userForm");
  const tLocales = useTranslations("users.localeValues");
  const locales = ["en", "es"].map((value) => ({
    value,
    label: tLocales(value),
  }));
  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {error && <AlertComponent title={error} variant="destructive" />}
        <RHFTextField name="name" label={t("fullName")} placeholder={t("fullNamePlaceholder")} fullWidth />
        <RHFTextField name="email" label={t("email")} placeholder={t("emailPlaceholder")} type="email" fullWidth />
        <RHFSelectField name="locale" label={t("locale")} placeholder={t("localePlaceholder")} options={locales} fullWidth />
        <RHFNumberField name="initialCreditAllocation" label={t("initialCreditAllocation")} description={t("initialCreditAllocationDescription")} min={0} max={2147483647} fullWidth />
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {t("generatedTemporaryPasswordNotice")}
        </p>
      </div>
      <div className="flex gap-3 border-t bg-background px-6 py-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading} className="flex-1">{t("cancel")}</Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("creating")}</> : t("create")}
        </Button>
      </div>
    </div>
  );
}
