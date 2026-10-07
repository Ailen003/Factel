"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { RHFTextField } from "@/components/form/rhf-components/rhf-text-field/rhf-text-field";
import { RHFSelectField } from "@/components/form/rhf-components/rhf-select-field/rhf-select-field";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import type { UserDetails } from "../lib/types/user.types";
import { getUserStatusLabel } from "../lib/types/user.types";

export default function UserForm({ user, loading, error, onCancel }: {
  user: UserDetails;
  loading: boolean;
  error: string | null;
  onCancel?: () => void;
}) {
  const t = useTranslations("userForm");
  const tRoles = useTranslations("users.roleValues");
  const tStatuses = useTranslations("users.statusValues");
  const tLocales = useTranslations("users.localeValues");
  const roleKey = user.role === "trial_user"
    ? "trial_user"
    : user.adminProfile ?? "unconfiguredAdmin";
  const locales = ["en", "es"].map((value) => ({
    value,
    label: tLocales(value),
  }));
  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {error && <AlertComponent title={error} variant="destructive" />}
        <RHFTextField name="name" label={t("fullName")} fullWidth />
        <div className="space-y-1"><p className="text-sm font-medium">{t("email")}</p><p className="break-all font-mono text-sm text-muted-foreground">{user.email}</p></div>
        <div className="space-y-1"><p className="text-sm font-medium">{t("role")}</p><p className="text-sm text-muted-foreground">{tRoles(roleKey)}</p><p className="text-xs text-muted-foreground">{t("roleReadOnly")}</p></div>
        <RHFSelectField name="locale" label={t("locale")} options={locales} fullWidth />
        <div className="space-y-1"><p className="text-sm font-medium">{t("status")}</p><p className="text-sm text-muted-foreground">{getUserStatusLabel(user.status, tStatuses)}</p></div>
      </div>
      <div className="flex gap-3 border-t bg-background px-6 py-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading} className="flex-1">{t("cancel")}</Button>
        <Button type="submit" disabled={loading} className="flex-1">{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("saving")}</> : t("save")}</Button>
      </div>
    </div>
  );
}
