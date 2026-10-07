import { z } from "zod";
import { createServiceRequestSchema, REQUEST_PRIORITIES, REQUEST_STATUSES, SERVICE_TYPES, type CreateServiceRequestSchema } from "../../form/create/schemas/create-service-request-schema";
import { editServiceRequestSchema, type EditServiceRequestSchema } from "../../form/edit/schemas/edit-service-request-schema";

export type ServiceType = typeof SERVICE_TYPES[number];
export type RequestPriority = typeof REQUEST_PRIORITIES[number];
export type ServiceRequestStatus = typeof REQUEST_STATUSES[number];

export interface ServiceRequestClient { id: string; name: string }
export interface ServiceRequest {
  id: string; client: ServiceRequestClient; title: string; description: string;
  serviceType: ServiceType; priority: RequestPriority; status: ServiceRequestStatus;
  preferredSchedule: string | null; serviceAddress: string | null; nextSteps: string | null;
  version: number; createdAt: string; updatedAt: string;
}
export type ServiceRequestDetails = ServiceRequest;
export interface ServiceRequestSummary {
  total: number; pending: number; in_progress: number; resolved: number; cancelled: number;
}
export interface ServiceRequestsResponse {
  requests: ServiceRequest[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary?: ServiceRequestSummary;
}

export const serviceRequestFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).catch(1),
  limit: z.coerce.number().int().refine((value) => [5, 10, 20, 30].includes(value)).catch(10),
  search: z.string().trim().max(100).optional(),
  clientId: z.string().trim().min(1).max(191).optional().catch(undefined),
  serviceType: z.enum(SERVICE_TYPES).optional().catch(undefined),
  priority: z.enum(REQUEST_PRIORITIES).optional().catch(undefined),
  status: z.enum(REQUEST_STATUSES).optional().catch(undefined),
  sortBy: z.enum(["createdAt", "updatedAt", "title", "priority", "status"]).catch("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).catch("desc"),
}).strict();
export type ServiceRequestFiltersDto = z.infer<typeof serviceRequestFiltersSchema>;
export function parseServiceRequestFilters(params: Record<string, string | string[] | undefined>): ServiceRequestFiltersDto {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  return serviceRequestFiltersSchema.parse({
    page: first(params.page), limit: first(params.limit), search: first(params.search)?.trim().slice(0, 100) || undefined,
    clientId: first(params.clientId) || undefined, serviceType: first(params.serviceType) || undefined,
    priority: first(params.priority) || undefined, status: first(params.status) || undefined,
    sortBy: first(params.sortBy), sortOrder: first(params.sortOrder),
  });
}

export type CreateServiceRequestDto = CreateServiceRequestSchema;
export const convertCreateServiceRequestDto = (values: CreateServiceRequestSchema): CreateServiceRequestDto => ({
  clientId: values.clientId, title: values.title.trim(), description: values.description.trim(),
  serviceType: values.serviceType, priority: values.priority,
  preferredSchedule: values.preferredSchedule?.trim() || undefined,
  serviceAddress: values.serviceAddress?.trim() || undefined, nextSteps: values.nextSteps?.trim() || undefined,
});
export interface ServiceRequestDraft {
  title: string; description: string; serviceType: ServiceType; priority: RequestPriority;
  preferredSchedule: string | null; serviceAddress: string | null; nextSteps: string | null;
}
export interface ServiceRequestCreationPreview {
  planId: string; planHash: string; expiresAt: string;
  client: ServiceRequestClient; request: ServiceRequestDraft;
}
export const confirmServiceRequestCreationSchema = z.object({
  planId: z.string().trim().min(1).max(191), planHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type ConfirmServiceRequestCreationInput = z.infer<typeof confirmServiceRequestCreationSchema>;
export interface ServiceRequestCreationResult { requestId: string; operationId: string; replayed: boolean }

export type EditServiceRequestDto = EditServiceRequestSchema;
export const editServiceRequestInputSchema = z.object({
  id: z.string().trim().min(1).max(191),
  expectedVersion: z.number().int().positive(),
  request: editServiceRequestSchema,
}).strict();
export type EditServiceRequestInput = z.infer<typeof editServiceRequestInputSchema>;

export const changeServiceRequestStatusInputSchema = z.object({
  id: z.string().trim().min(1).max(191),
  expectedVersion: z.number().int().positive(),
  status: z.enum(REQUEST_STATUSES),
}).strict();
export type ChangeServiceRequestStatusInput = z.infer<typeof changeServiceRequestStatusInputSchema>;

export const deleteServiceRequestInputSchema = z.object({
  id: z.string().trim().min(1).max(191),
  expectedVersion: z.number().int().positive(),
}).strict();
export type DeleteServiceRequestInput = z.infer<typeof deleteServiceRequestInputSchema>;
export interface DeleteServiceRequestResult { requestId: string }

export const clientCatalogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1), limit: z.coerce.number().int().min(1).max(50).catch(25),
  search: z.string().trim().max(100).optional(), selectedId: z.string().trim().min(1).max(191).optional(),
}).strict();
export type ClientCatalogQuery = z.infer<typeof clientCatalogQuerySchema>;
export interface ClientCatalogOption { id: string; label: string }
export interface ClientCatalogResponse {
  options: ClientCatalogOption[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const serviceRequestIdSchema = z.string().trim().min(1).max(191);
export const clientServiceRequestsInputSchema = serviceRequestFiltersSchema.extend({
  clientId: z.string().trim().min(1).max(191),
}).strict();

export function normalizeRequestDraft(dto: CreateServiceRequestDto): ServiceRequestDraft {
  const parsed = createServiceRequestSchema.parse(dto);
  return {
    title: parsed.title.trim(), description: parsed.description.trim(), serviceType: parsed.serviceType,
    priority: parsed.priority, preferredSchedule: parsed.preferredSchedule?.trim() || null,
    serviceAddress: parsed.serviceAddress?.trim() || null, nextSteps: parsed.nextSteps?.trim() || null,
  };
}
