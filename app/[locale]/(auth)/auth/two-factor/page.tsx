import { getTranslations } from "next-intl/server";
import { TwoFactorChallengeContent } from "@/modules/two-factor/challenge/two-factor-challenge-content";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const tApp = await getTranslations("app");
  const t = await getTranslations("twoFactor.metadata");
  return { title: `${t("challengeTitle")} | ${tApp("name")}`, description: t("challengeDescription") };
}

export default function TwoFactorChallengePage() {
  return <TwoFactorChallengeContent />;
}
