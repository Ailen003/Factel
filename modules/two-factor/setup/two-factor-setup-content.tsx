import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getSafeReturnTo, localizePath } from "@/lib/auth/route-access";
import { getTwoFactorStatusAction } from "../lib/actions/two-factor.actions";
import { TwoFactorAuthShell } from "../components/two-factor-auth-shell";
import { TwoFactorSetupContainer } from "./two-factor-setup-container";

export async function TwoFactorSetupContent({
  locale,
  returnTo,
}: {
  locale: string;
  returnTo?: string;
}) {
  const state = await getTwoFactorStatusAction();
  if (!state.success) {
    redirect(localizePath(locale, state.error.code === "UNAUTHENTICATED" ? "/auth/login" : "/dashboard"));
  }
  if (state.data.status === "password-change-required") {
    redirect(localizePath(locale, "/auth/change-password"));
  }
  const t = await getTranslations("twoFactor.setup");
  const safeReturnTo = getSafeReturnTo(returnTo, "platform_admin");

  return (
    <TwoFactorAuthShell
      icon={<ShieldCheck className="h-6 w-6" />}
      title={t("title")}
      description={t("description")}
    >
      <TwoFactorSetupContainer initialStatus={state.data.status} returnTo={safeReturnTo} />
    </TwoFactorAuthShell>
  );
}
