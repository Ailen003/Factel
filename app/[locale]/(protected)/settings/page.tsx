import { getTranslations } from "next-intl/server";
import { requirePageAdminCapability } from "@/lib/auth/page-guard";
import PlatformSettingsContent from "@/modules/platform-settings/platform-settings-content";

export async function generateMetadata() {
  const tApp = await getTranslations("app");
  const t = await getTranslations("platformSettings");
  return {
    title: `${t("title")} | ${tApp("name")}`,
    description: t("description"),
  };
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requirePageAdminCapability(locale, "platform.settings.read", "/settings");
  return <PlatformSettingsContent />;
}
