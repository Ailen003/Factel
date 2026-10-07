"use client";

import { Loader2, Mail, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { RHFTextAreaField } from "@/components/form/rhf-components/rhf-text-area-field/rhf-text-area-field";
import { RHFTextField } from "@/components/form/rhf-components/rhf-text-field/rhf-text-field";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";

export function AccessRequestForm({
  loading,
  error,
  preparedEmail,
}: {
  loading: boolean;
  error: string | null;
  preparedEmail: string | null;
}) {
  const t = useTranslations("accessRequestForm");
  return (
    <div className="space-y-5">
      {error && <AlertComponent title={error} variant="destructive" />}
      {preparedEmail && (
        <AlertComponent
          title={t("preparedTitle")}
          description={t("preparedDescription", { email: preparedEmail })}
        />
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <RHFTextField
          name="fullName"
          label={t("fullName")}
          placeholder={t("fullNamePlaceholder")}
          maxLength={120}
        />
        <RHFTextField
          name="email"
          type="email"
          label={t("email")}
          placeholder={t("emailPlaceholder")}
          maxLength={320}
        />
      </div>
      <RHFTextField
        name="organization"
        label={t("organization")}
        placeholder={t("organizationPlaceholder")}
        description={t("organizationDescription")}
        maxLength={160}
      />
      <RHFTextAreaField
        name="message"
        label={t("message")}
        placeholder={t("messagePlaceholder")}
        description={t("messageDescription")}
        rows={6}
      />
      <div className="rounded-xl border border-cyan-200/15 bg-cyan-300/5 p-4 text-sm leading-6 text-slate-300">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 size-5 shrink-0 text-cyan-300" aria-hidden="true" />
          <p>{t("privacyNotice")}</p>
        </div>
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="h-12 w-full rounded-full bg-cyan-300 text-[#07111f] hover:bg-cyan-200 sm:w-auto"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        {loading ? t("preparing") : t("submit")}
      </Button>
    </div>
  );
}
