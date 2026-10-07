import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { TwoFactorAuthShell } from "../components/two-factor-auth-shell";
import { TwoFactorChallengeContainer } from "./two-factor-challenge-container";

export async function TwoFactorChallengeContent() {
  const t = await getTranslations("twoFactor.challenge");
  return (
    <TwoFactorAuthShell
      icon={<ShieldCheck className="h-6 w-6" />}
      title={t("title")}
      description={t("description")}
    >
      <Suspense fallback={<div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />}>
        <TwoFactorChallengeContainer />
      </Suspense>
    </TwoFactorAuthShell>
  );
}
