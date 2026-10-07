import { getTranslations } from "next-intl/server";
import { requirePageRoles } from "@/lib/auth/page-guard";
import ConversationsContent from "@/modules/conversations/conversations-content";
import { parseConversationFilters } from "@/modules/conversations/lib/types/conversation.types";

export async function generateMetadata() {
  const t = await getTranslations("conversations");
  const app = await getTranslations("app");
  return { title: `${t("title")} | ${app("name")}`, description: t("description") };
}

export default async function ConversationsPage({ searchParams, params }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requirePageRoles(locale, ["platform_admin", "trial_user"], "/conversations");
  return <ConversationsContent filters={parseConversationFilters(await searchParams)} routeLocale={locale} />;
}
