import { getTranslations } from "next-intl/server";
import { requirePageRoles } from "@/lib/auth/page-guard";
import ClientsContent from "@/modules/clients/clients-content";
import { parseClientFilters } from "@/modules/clients/lib/types/client.types";

export async function generateMetadata() {
  const t = await getTranslations("clients");
  const app = await getTranslations("app");
  return { title: `${t("title")} | ${app("name")}`, description: t("description") };
}

export default async function ClientsPage({ searchParams, params }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requirePageRoles(locale, ["platform_admin", "trial_user"], "/clients");
  return <ClientsContent filters={parseClientFilters(await searchParams)} />;
}
