"use client";

import { Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { RHFTextField } from "@/components/form/rhf-components/rhf-text-field/rhf-text-field";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";

export function PlatformSettingsForm({
  loading,
  error,
}: {
  loading: boolean;
  error: string | null;
}) {
  const t = useTranslations("platformSettings.form");
  return (
    <div className="space-y-6">
      {error && <AlertComponent title={error} variant="destructive" />}
      <RHFTextField
        name="accessContactEmail"
        type="email"
        label={t("contactEmail")}
        placeholder={t("contactEmailPlaceholder")}
        description={t("contactEmailDescription")}
        maxLength={320}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {loading ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
