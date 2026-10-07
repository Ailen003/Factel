"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function TemporaryCredentialDisplay({
  email,
  temporaryPassword,
  expiresAt,
}: {
  email: string;
  temporaryPassword: string;
  expiresAt: string;
}) {
  const locale = useLocale();
  const t = useTranslations("users.create.credential");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const formattedExpiry = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(expiresAt));

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="space-y-2">
          <p className="font-medium">{t("title")}</p>
          <p className="text-sm">{t("warning")}</p>
        </div>
      </div>

      <dl className="space-y-4">
        <div>
          <dt className="text-sm font-medium text-muted-foreground">{t("email")}</dt>
          <dd className="break-all text-sm">{email}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">{t("password")}</dt>
          <dd className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 select-all break-all rounded-md bg-muted px-3 py-2 font-mono text-sm">
              {temporaryPassword}
            </code>
            <Button type="button" variant="outline" onClick={copyPassword}>
              {copyState === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copyState === "copied" ? t("copied") : t("copy")}
            </Button>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">{t("expires")}</dt>
          <dd className="text-sm">{t("expiresValue", { date: formattedExpiry })}</dd>
        </div>
      </dl>

      <p
        className={copyState === "failed" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        aria-live="polite"
      >
        {copyState === "copied"
          ? t("copiedConfirmation")
          : copyState === "failed"
            ? t("copyFailed")
            : t("delivery")}
      </p>
    </div>
  );
}
