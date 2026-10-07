"use server";

import { getDashboardMetrics } from "../services/dashboard.services";

export async function getDashboardMetricsAction() {
  return getDashboardMetrics();
}
