import { Suspense } from "react";
import { getTranslations } from 'next-intl/server';
import { ModuleHeader } from "@/modules/components/module-header/module-header";
import UsersFiltersContainer from "./filters/users-filters-container";
import UsersListContainer from "./list/users-list-container";
import UsersListLoadingSkeleton from "./list/users-list-loading-skeleton";
import UsersStatsContainer from "./components/users-stats/users-stats-container";
import FiltersSkeleton from "@/components/filters/filters-container-skeleton/filters-skeleton";
import { UserFiltersDto } from "./lib/types/user.types";
import { Users } from "lucide-react";
import CreateUserTrigger from "./form/create/create-user-trigger";
import { requireAdminCapability } from "@/lib/auth/admin-authorization";
import { hasAdminCapability } from "@/lib/auth/admin-capabilities";

interface Props {
  filters: UserFiltersDto;
}

export default async function UsersContent({ filters }: Props) {
  const session = await requireAdminCapability("trial.read");
  const canManageAdmins = hasAdminCapability(session.user, "admin.manage");
  const canManageTrialUsers = hasAdminCapability(session.user, "trial.create");
  const t = await getTranslations('users');
  const filtersKey = JSON.stringify(filters);
  return (
    <div className="flex flex-col gap-3">
      <ModuleHeader
        title={t('title')}
        icon={<Users className="h-10 w-10" />}
        description={t('description')}
        actionTrigger={canManageTrialUsers ? <CreateUserTrigger /> : undefined}
        showRefresh
      />
      <UsersStatsContainer />
      <div className="mt-6">
        <Suspense fallback={<FiltersSkeleton inputCount={3} />}>
        <UsersFiltersContainer />
      </Suspense>
      </div>
      <div className="mt-6">
        <Suspense key={`users-list-${filtersKey}`} fallback={<UsersListLoadingSkeleton />}>
          <UsersListContainer
            filters={filters}
            currentUserId={session.user.id}
            canManageAdmins={canManageAdmins}
            canManageTrialUsers={canManageTrialUsers}
          />
        </Suspense>
      </div>
    </div>
  );
}
