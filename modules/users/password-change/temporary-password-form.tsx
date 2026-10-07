"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { RHFPasswordField } from "@/components/form/rhf-components/rhf-password-field/rhf-password-field";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";

export function TemporaryPasswordForm({
  loading,
  error,
  onSignOut,
}: {
  loading: boolean;
  error: string | null;
  onSignOut: () => void;
}) {
  const t = useTranslations("temporaryPassword");
  return (
    <div className="space-y-5">
      {error && <AlertComponent title={error} variant="destructive" />}
      <RHFPasswordField
        name="currentPassword"
        label={t("currentPassword")}
        placeholder={t("currentPasswordPlaceholder")}
        autoComplete="current-password"
        showPasswordLabel={t("showPassword")}
        hidePasswordLabel={t("hidePassword")}
        fullWidth
      />
      <RHFPasswordField
        name="newPassword"
        label={t("newPassword")}
        placeholder={t("newPasswordPlaceholder")}
        description={t("passwordHint")}
        autoComplete="new-password"
        showPasswordLabel={t("showPassword")}
        hidePasswordLabel={t("hidePassword")}
        fullWidth
      />
      <RHFPasswordField
        name="confirmPassword"
        label={t("confirmPassword")}
        placeholder={t("confirmPasswordPlaceholder")}
        autoComplete="new-password"
        showPasswordLabel={t("showPassword")}
        hidePasswordLabel={t("hidePassword")}
        fullWidth
      />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onSignOut} disabled={loading}>
          {t("signOut")}
        </Button>
        <Button type="submit" disabled={loading} className="sm:min-w-48">
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("saving")}</>
          ) : t("submit")}
        </Button>
      </div>
    </div>
  );
}
