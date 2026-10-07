import { getTranslations } from "next-intl/server";
import TemporaryPasswordContent from "@/modules/users/password-change/temporary-password-content";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const tApp = await getTranslations("app");
  const t = await getTranslations("temporaryPassword");
  return { title: `${t("title")} | ${tApp("name")}`, description: t("description") };
}

export default async function ChangePasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <TemporaryPasswordContent locale={locale} />;
}
