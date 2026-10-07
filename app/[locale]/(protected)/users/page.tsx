import UsersContent from "@/modules/users/users-content";
import { UserFiltersDto } from "@/modules/users/lib/types/user.types";
import { getTranslations } from 'next-intl/server';
import { requirePageAdminCapability } from '@/lib/auth/page-guard';
import { parseUserFilters } from '@/modules/users/lib/types/user.types';

export async function generateMetadata() {
  const tApp = await getTranslations('app');
  const t = await getTranslations('users');
  return {
    title: `${t("title")} | ${tApp("name")}`,
    description: t('description'),
  };
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{ locale: string }>;
}

export default async function UsersPage({ searchParams, params }: Props) {
  const { locale } = await params;
  await requirePageAdminCapability(locale, "trial.read", "/users");
  const filters: UserFiltersDto = parseUserFilters(await searchParams);
  return <UsersContent filters={filters} />;
}
