import { getTranslations } from "next-intl/server";
import { TwoFactorSetupContent } from "@/modules/two-factor/setup/two-factor-setup-content";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const tApp = await getTranslations("app");
  const t = await getTranslations("twoFactor.metadata");
  return { title: `${t("setupTitle")} | ${tApp("name")}`, description: t("setupDescription") };
}

export default async function TwoFactorSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const [{ locale }, { returnTo }] = await Promise.all([params, searchParams]);
  return <TwoFactorSetupContent locale={locale} returnTo={returnTo} />;
}
