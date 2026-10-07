import type { RequestPriority, ServiceRequestFiltersDto, ServiceRequestStatus, ServiceType } from "../lib/types/service-request.types";

export interface ServiceRequestFilterState {
  search: string;
  clientId: string;
  serviceType: ServiceType | "";
  priority: RequestPriority | "";
  status: ServiceRequestStatus | "";
  sortBy: ServiceRequestFiltersDto["sortBy"];
  sortOrder: "asc" | "desc";
}

export const DEFAULT_SERVICE_REQUEST_FILTERS: ServiceRequestFilterState = {
  search: "", clientId: "", serviceType: "", priority: "", status: "", sortBy: "createdAt", sortOrder: "desc",
};

export function readServiceRequestFilters(params: URLSearchParams): ServiceRequestFilterState {
  const serviceType = params.get("serviceType");
  const priority = params.get("priority");
  const status = params.get("status");
  const sortBy = params.get("sortBy");
  return {
    search: params.get("search") ?? "",
    clientId: params.get("clientId") ?? "",
    serviceType: ["installation", "repair", "maintenance", "inspection", "other"].includes(serviceType ?? "") ? serviceType as ServiceType : "",
    priority: ["low", "normal", "high"].includes(priority ?? "") ? priority as RequestPriority : "",
    status: ["pending", "in_progress", "resolved", "cancelled"].includes(status ?? "") ? status as ServiceRequestStatus : "",
    sortBy: ["createdAt", "updatedAt", "title", "priority", "status"].includes(sortBy ?? "") ? sortBy as ServiceRequestFiltersDto["sortBy"] : "createdAt",
    sortOrder: params.get("sortOrder") === "asc" ? "asc" : "desc",
  };
}

export function serviceRequestFiltersToDto(filters: ServiceRequestFilterState): Omit<ServiceRequestFiltersDto, "page" | "limit"> {
  return {
    search: filters.search || undefined, clientId: filters.clientId || undefined,
    serviceType: filters.serviceType || undefined, priority: filters.priority || undefined,
    status: filters.status || undefined, sortBy: filters.sortBy, sortOrder: filters.sortOrder,
  };
}
