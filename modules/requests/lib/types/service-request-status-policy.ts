import type { ServiceRequestStatus } from "./service-request.types";

export const SERVICE_REQUEST_STATUS_TRANSITIONS = {
  pending: ["in_progress", "resolved", "cancelled"],
  in_progress: ["pending", "resolved", "cancelled"],
  resolved: ["pending"],
  cancelled: ["pending"],
} as const satisfies Record<ServiceRequestStatus, readonly ServiceRequestStatus[]>;

export function getAllowedServiceRequestStatuses(status: ServiceRequestStatus): readonly ServiceRequestStatus[] {
  return SERVICE_REQUEST_STATUS_TRANSITIONS[status];
}

export function canTransitionServiceRequestStatus(
  current: ServiceRequestStatus,
  next: ServiceRequestStatus,
): boolean {
  return getAllowedServiceRequestStatuses(current).some((status) => status === next);
}
