"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/auth-client";
import { localizePath } from "@/lib/auth/route-access";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";

export function ExpiredTemporaryPassword() {
  const params = useParams();
  const locale = (params.locale as string) ?? "en";
  const t = useTranslations("temporaryPassword");

  async function signOut() {
    await authClient.signOut();
    window.location.assign(localizePath(locale, "/auth/login"));
  }

  return (
    <div className="space-y-5">
      <AlertComponent title={t("expiredTitle")} description={t("expiredDescription")} variant="destructive" />
      <p className="text-sm text-muted-foreground">{t("expiredContact")}</p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={signOut}>{t("signOut")}</Button>
        <Button asChild>
          <a href={localizePath(locale, "/#request-access")}>{t("contactTeam")}</a>
        </Button>
      </div>
    </div>
  );
}
