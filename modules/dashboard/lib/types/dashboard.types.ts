import type {
  ServiceRequest,
  ServiceRequestSummary,
} from "@/modules/requests/lib/types/service-request.types";

export interface DashboardMetrics {
  totalClients: number;
  totalRequests: number;
  requestSummary: ServiceRequestSummary;
  recentRequests: ServiceRequest[];
}
