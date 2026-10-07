"use client";
import { StatCard } from "@/components/ui/stat-card";
import { ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { UsersStats } from "../../lib/types/user.types";

interface Props {
  stats: UsersStats;
}

export default function UsersStatsPresentational({ stats }: Props) {
  const t = useTranslations('stats');
  return (
    <div className="grid gap-4 xs:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={t('totalUsers')}
        value={stats.totalUsers}
        icon={Users}
      />

      <StatCard
        title={t('platformAdmins')}
        value={stats.platformAdmins}
        icon={ShieldCheck}
      />

      <StatCard
        title={t('active')}
        value={stats.active}
        icon={UserCheck}
      />

      <StatCard
        title={t('suspended')}
        value={stats.suspended}
        icon={UserX}
      />
    </div>
  );
}
