"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Ban,
  CircleCheck,
  Clock3,
  ListChecks,
  LoaderCircle,
  UsersRound,
} from "lucide-react";
import type { ServiceResponse } from "@/lib/api-responses";
import { Link } from "@/i18n/navigation";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import ServiceRequestManagementDialogs from "@/modules/requests/components/service-request-management-dialogs";
import { useServiceRequestManagement } from "@/modules/requests/list/hooks";
import ServiceRequestListCardsView from "@/modules/requests/list/service-request-list-cards-view";
import ServiceRequestListTableView from "@/modules/requests/list/service-request-list-table-view";
import type { DashboardMetrics } from "../lib/types/dashboard.types";

export default function DashboardMetricsPresentational({
  response,
}: {
  response: ServiceResponse<DashboardMetrics>;
}) {
  const t = useTranslations("operationalDashboard");
  const router = useRouter();
  const management = useServiceRequestManagement();

  if (!response.success) {
    const errorKey = `errors.${response.error.code}` as never;

    return (
      <div className="space-y-3">
        <AlertComponent
          variant="destructive"
          title={t.has(errorKey) ? t(errorKey) : t("errors.INTERNAL_ERROR")}
        />
        <Button variant="outline" onClick={() => router.refresh()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const { recentRequests, requestSummary, totalClients, totalRequests } = response.data;
  const refreshAfterMutation = () => setTimeout(() => router.refresh(), 300);

  return (
    <div className="space-y-6">
      <section aria-label={t("sections.summary")} className="space-y-3">
        <div className="grid gap-3 xs:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          <StatCard title={t("metrics.totalClients")} value={totalClients} icon={UsersRound} />
          <StatCard title={t("metrics.totalRequests")} value={totalRequests} icon={ListChecks} />
          <StatCard
            title={t("metrics.pending")}
            value={requestSummary.pending}
            icon={Clock3}
            iconBgColor="bg-amber-500/15"
            iconColor="text-amber-700 dark:text-amber-300"
          />
          <StatCard
            title={t("metrics.inProgress")}
            value={requestSummary.in_progress}
            icon={LoaderCircle}
            iconBgColor="bg-blue-500/15"
            iconColor="text-blue-700 dark:text-blue-300"
          />
          <StatCard
            title={t("metrics.resolved")}
            value={requestSummary.resolved}
            icon={CircleCheck}
            iconBgColor="bg-emerald-500/15"
            iconColor="text-emerald-700 dark:text-emerald-300"
          />
          <StatCard
            title={t("metrics.cancelled")}
            value={requestSummary.cancelled}
            icon={Ban}
            iconBgColor="bg-rose-500/15"
            iconColor="text-rose-700 dark:text-rose-300"
          />
        </div>
        <nav aria-label={t("navigation.label")} className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/clients">{t("navigation.clients")}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/requests">{t("navigation.requests")}</Link>
          </Button>
        </nav>
      </section>

      <Card className="shadow-sm">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{t("sections.recentRequests")}</CardTitle>
            <CardDescription>{t("sections.recentRequestsDescription")}</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/requests">{t("navigation.allRequests")}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentRequests.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              {t("noRecentRequests")}
            </p>
          ) : (
            <>
              <div className="hidden md:block">
                <ServiceRequestListTableView
                  requests={recentRequests}
                  onView={management.view}
                  onEdit={management.edit}
                  onChangeStatus={management.changeStatus}
                  onDelete={management.remove}
                  embedded
                />
              </div>
              <div className="block md:hidden">
                <ServiceRequestListCardsView
                  requests={recentRequests}
                  onView={management.view}
                  onEdit={management.edit}
                  onChangeStatus={management.changeStatus}
                  onDelete={management.remove}
                  embedded
                />
              </div>
              <ServiceRequestManagementDialogs
                management={management}
                onMutated={refreshAfterMutation}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
