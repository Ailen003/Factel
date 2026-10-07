import { getDashboardMetricsAction } from "../lib/actions/dashboard.actions";
import DashboardMetricsPresentational from "./dashboard-metrics-presentational";

export default async function DashboardMetricsContainer() {
  const response = await getDashboardMetricsAction();

  return <DashboardMetricsPresentational response={response} />;
}
