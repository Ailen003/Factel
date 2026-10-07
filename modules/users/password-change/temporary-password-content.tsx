import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { KeyRound, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/modules/landing/components/logo";
import { localizePath } from "@/lib/auth/route-access";
import { getTemporaryPasswordState } from "../lib/services/temporary-password.services";
import { TemporaryPasswordFormContainer } from "./temporary-password-form-container";
import { ExpiredTemporaryPassword } from "./expired-temporary-password";

export default async function TemporaryPasswordContent({ locale }: { locale: string }) {
  const state = await getTemporaryPasswordState();
  if (!state.success) redirect(localizePath(locale, "/auth/login"));
  if (state.data.status === "complete") redirect(localizePath(locale, "/dashboard"));
  const t = await getTranslations("temporaryPassword");
  const isRecovery = state.data.purpose === "recovery";
  const formattedExpiry = state.data.expiresAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(state.data.expiresAt))
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="flex items-center justify-between gap-4 p-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2"><LanguageToggle /><ThemeToggle /></div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <Card className="w-full max-w-xl shadow-lg">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
              {state.data.status === "expired" ? <KeyRound className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl">
                {state.data.status === "expired"
                  ? t("expiredTitle")
                  : t(isRecovery ? "recoveryTitle" : "title")}
              </CardTitle>
              <CardDescription>
                {state.data.status === "expired"
                  ? t("expiredSummary")
                  : t(isRecovery ? "recoveryDescription" : "description")}
              </CardDescription>
            </div>
            {formattedExpiry && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                {t("expiresAt", { date: formattedExpiry })}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {state.data.status === "expired"
              ? <ExpiredTemporaryPassword />
              : <TemporaryPasswordFormContainer />}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
