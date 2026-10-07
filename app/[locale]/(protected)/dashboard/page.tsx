import { getTranslations } from "next-intl/server";
import { requirePageRoles } from "@/lib/auth/page-guard";
import { DashboardContent } from "@/modules/dashboard/dashboard-content";

export async function generateMetadata() {
  const tApp = await getTranslations("app");
  const t = await getTranslations("operationalDashboard");

  return {
    title: `${t("title")} | ${tApp("name")}`,
    description: t("description"),
  };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requirePageRoles(locale, ["trial_user", "platform_admin"], "/dashboard");

  return <DashboardContent />;
}
