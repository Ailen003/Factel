import { getTranslations } from "next-intl/server";
import { requirePageRoles } from "@/lib/auth/page-guard";
import RequestsContent from "@/modules/requests/requests-content";
import { parseServiceRequestFilters } from "@/modules/requests/lib/types/service-request.types";

export async function generateMetadata() {
  const t = await getTranslations("requests"); const app = await getTranslations("app");
  return { title: `${t("title")} | ${app("name")}`, description: t("description") };
}
export default async function RequestsPage({ searchParams, params }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requirePageRoles(locale, ["platform_admin", "trial_user"], "/requests");
  return <RequestsContent filters={parseServiceRequestFilters(await searchParams)} />;
}
