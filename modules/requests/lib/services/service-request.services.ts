import "server-only";

import { Prisma, type RequestPriority as PrismaRequestPriority, type ServiceRequestStatus as PrismaRequestStatus, type ServiceType as PrismaServiceType } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { resolveCurrentWorkspace } from "@/lib/auth/session";
import type { ServiceResponse } from "@/lib/api-responses";
import { assertRecordAccess, isRetryableRecordConflict, recordError, recordFailure } from "@/lib/records/record-policy";
import { hasExcludedSensitiveValues } from "@/lib/records/sensitive-submission-policy";
import {
  changeServiceRequestStatusInputSchema, clientCatalogQuerySchema, deleteServiceRequestInputSchema,
  editServiceRequestInputSchema, serviceRequestFiltersSchema, serviceRequestIdSchema,
  type ChangeServiceRequestStatusInput,
  type ClientCatalogQuery, type ClientCatalogResponse, type ServiceRequest, type ServiceRequestFiltersDto,
  type DeleteServiceRequestInput, type DeleteServiceRequestResult, type EditServiceRequestInput,
  type ServiceRequestStatus, type ServiceRequestSummary, type ServiceRequestsResponse,
} from "../types/service-request.types";
import { canTransitionServiceRequestStatus } from "../types/service-request-status-policy";

const requestSelect = {
  id: true, title: true, description: true, serviceType: true, priority: true, status: true,
  preferredSchedule: true, serviceAddress: true, nextSteps: true, version: true,
  createdAt: true, updatedAt: true, client: { select: { id: true, name: true } },
} satisfies Prisma.ServiceRequestSelect;
type SelectedRequest = Prisma.ServiceRequestGetPayload<{ select: typeof requestSelect }>;

function mapRequest(row: SelectedRequest): ServiceRequest {
  return {
    ...row,
    serviceType: row.serviceType.toLowerCase() as ServiceRequest["serviceType"],
    priority: row.priority.toLowerCase() as ServiceRequest["priority"],
    status: row.status.toLowerCase() as ServiceRequest["status"],
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

function requestWhere(workspaceId: string, input: ServiceRequestFiltersDto): Prisma.ServiceRequestWhereInput {
  return {
    workspaceId,
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(input.serviceType ? { serviceType: input.serviceType.toUpperCase() as PrismaServiceType } : {}),
    ...(input.priority ? { priority: input.priority.toUpperCase() as PrismaRequestPriority } : {}),
    ...(input.status ? { status: input.status.toUpperCase() as PrismaRequestStatus } : {}),
    ...(input.search ? { OR: [
      { title: { contains: input.search, mode: "insensitive" } },
      { description: { contains: input.search, mode: "insensitive" } },
      { client: { name: { contains: input.search, mode: "insensitive" } } },
    ] } : {}),
  };
}

function emptySummary(): ServiceRequestSummary {
  return { total: 0, pending: 0, in_progress: 0, resolved: 0, cancelled: 0 };
}

async function readRequests(filters: ServiceRequestFiltersDto, includeSummary: boolean): Promise<ServiceResponse<ServiceRequestsResponse>> {
  const parsed = serviceRequestFiltersSchema.safeParse(filters);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  const input = parsed.data;
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    return await prisma.$transaction(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      if (includeSummary) {
        const client = await tx.client.findFirst({ where: { id: input.clientId, workspaceId: workspace.id }, select: { id: true } });
        if (!client) return recordFailure("NOT_FOUND");
      }
      const where = requestWhere(workspace.id, input);
      const total = await tx.serviceRequest.count({ where });
      const totalPages = Math.max(1, Math.ceil(total / input.limit));
      const page = Math.min(input.page, totalPages);
      const rows = await tx.serviceRequest.findMany({ where, select: requestSelect,
        orderBy: [{ [input.sortBy]: input.sortOrder }, { id: "asc" }], skip: (page - 1) * input.limit, take: input.limit });
      let summary: ServiceRequestSummary | undefined;
      if (includeSummary && input.clientId) {
        summary = emptySummary();
        const counts = await tx.serviceRequest.groupBy({ by: ["status"],
          where: { workspaceId: workspace.id, clientId: input.clientId }, _count: { _all: true } });
        for (const item of counts) {
          const key = item.status.toLowerCase() as keyof Omit<ServiceRequestSummary, "total">;
          summary[key] = item._count._all;
          summary.total += item._count._all;
        }
      }
      return { success: true as const, data: { requests: rows.map(mapRequest),
        pagination: { page, limit: input.limit, total, totalPages }, ...(summary ? { summary } : {}) } };
    }, { isolationLevel: "RepeatableRead" });
  } catch (error) { return recordError(error); }
}

export async function getAllServiceRequests(filters: ServiceRequestFiltersDto) {
  return readRequests(filters, false);
}

export async function getClientServiceRequests(filters: ServiceRequestFiltersDto) {
  if (!filters.clientId) return recordFailure("VALIDATION_ERROR");
  return readRequests(filters, true);
}

export async function getServiceRequestById(id: string): Promise<ServiceResponse<ServiceRequest>> {
  const parsed = serviceRequestIdSchema.safeParse(id);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    return await prisma.$transaction(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      const row = await tx.serviceRequest.findFirst({ where: { id: parsed.data, workspaceId: workspace.id }, select: requestSelect });
      return row ? { success: true as const, data: mapRequest(row) } : recordFailure("NOT_FOUND");
    }, { isolationLevel: "RepeatableRead" });
  } catch (error) { return recordError(error); }
}

export async function getClientCatalog(query: ClientCatalogQuery): Promise<ServiceResponse<ClientCatalogResponse>> {
  const parsed = clientCatalogQuerySchema.safeParse(query);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  const input = parsed.data;
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    return await prisma.$transaction(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      const where: Prisma.ClientWhereInput = { workspaceId: workspace.id,
        ...(input.search ? { OR: [
          { name: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
          { phone: { contains: input.search } },
          { company: { contains: input.search, mode: "insensitive" } },
        ] } : {}) };
      const total = await tx.client.count({ where });
      const totalPages = Math.max(1, Math.ceil(total / input.limit));
      const page = Math.min(input.page, totalPages);
      const rows = await tx.client.findMany({ where, select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * input.limit, take: input.limit });
      if (input.selectedId && !rows.some((row) => row.id === input.selectedId)) {
        const selected = await tx.client.findFirst({ where: { id: input.selectedId, workspaceId: workspace.id }, select: { id: true, name: true } });
        if (selected) rows.unshift(selected);
      }
      return { success: true as const, data: { options: rows.map(({ id, name }) => ({ id, label: name })),
        pagination: { page, limit: input.limit, total, totalPages } } };
    }, { isolationLevel: "RepeatableRead" });
  } catch (error) { return recordError(error); }
}

async function writeRequestAudit(tx: Prisma.TransactionClient, input: {
  workspaceId: string; actorId: string; requestId: string; action: string;
  outcome: "SUCCEEDED" | "DENIED"; reason?: string;
  fromStatus?: ServiceRequestStatus; toStatus?: ServiceRequestStatus;
  reassigned?: boolean; fromClientId?: string; toClientId?: string;
}) {
  await tx.auditEvent.create({ data: {
    workspaceId: input.workspaceId, actorUserId: input.actorId,
    resourceType: "service_request", resourceId: input.requestId, action: input.action,
    outcome: input.outcome, correlationId: crypto.randomUUID(),
    safeMetadata: {
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.fromStatus ? { fromStatus: input.fromStatus } : {}),
      ...(input.toStatus ? { toStatus: input.toStatus } : {}),
      ...(input.reassigned !== undefined ? { reassigned: input.reassigned } : {}),
      ...(input.fromClientId ? { fromClientId: input.fromClientId } : {}),
      ...(input.toClientId ? { toClientId: input.toClientId } : {}),
    },
  } });
}

function normalizeEditRequest(input: EditServiceRequestInput) {
  return {
    clientId: input.request.clientId,
    title: input.request.title.trim(),
    description: input.request.description.trim(),
    serviceType: input.request.serviceType.toUpperCase() as PrismaServiceType,
    priority: input.request.priority.toUpperCase() as PrismaRequestPriority,
    preferredSchedule: input.request.preferredSchedule?.trim() || null,
    serviceAddress: input.request.serviceAddress?.trim() || null,
    nextSteps: input.request.nextSteps?.trim() || null,
  };
}

export async function editServiceRequest(input: EditServiceRequestInput): Promise<ServiceResponse<ServiceRequest>> {
  const parsed = editServiceRequestInputSchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  const next = normalizeEditRequest(parsed.data);
  if (hasExcludedSensitiveValues({
    title: next.title, description: next.description, preferredSchedule: next.preferredSchedule,
    serviceAddress: next.serviceAddress, nextSteps: next.nextSteps,
  })) return recordFailure("SENSITIVE_DATA");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          await assertRecordAccess(tx, session, workspace.id);
          const current = await tx.serviceRequest.findFirst({
            where: { id: parsed.data.id, workspaceId: workspace.id },
            select: { id: true, version: true, clientId: true },
          });
          if (!current) return recordFailure("NOT_FOUND");
          if (current.version !== parsed.data.expectedVersion) {
            await writeRequestAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
              requestId: current.id, action: "service_request.update", outcome: "DENIED", reason: "STALE_VERSION",
              reassigned: current.clientId !== next.clientId, fromClientId: current.clientId });
            return recordFailure("STALE_VERSION");
          }
          const client = await tx.client.findFirst({
            where: { id: next.clientId, workspaceId: workspace.id }, select: { id: true },
          });
          if (!client) {
            await writeRequestAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
              requestId: current.id, action: "service_request.update", outcome: "DENIED", reason: "NOT_FOUND",
              reassigned: current.clientId !== next.clientId, fromClientId: current.clientId });
            return recordFailure("NOT_FOUND");
          }
          const updated = await tx.serviceRequest.updateMany({
            where: { id: current.id, workspaceId: workspace.id, version: current.version },
            data: { ...next, updatedByUserId: session.user.id, version: { increment: 1 } },
          });
          if (updated.count !== 1) {
            await writeRequestAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
              requestId: current.id, action: "service_request.update", outcome: "DENIED", reason: "STALE_VERSION",
              reassigned: current.clientId !== next.clientId, fromClientId: current.clientId });
            return recordFailure("STALE_VERSION");
          }
          await writeRequestAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
            requestId: current.id, action: "service_request.update", outcome: "SUCCEEDED",
            reassigned: current.clientId !== next.clientId,
            ...(current.clientId !== next.clientId ? { fromClientId: current.clientId, toClientId: next.clientId } : {}) });
          const row = await tx.serviceRequest.findFirst({
            where: { id: current.id, workspaceId: workspace.id }, select: requestSelect,
          });
          return row ? { success: true as const, data: mapRequest(row) } : recordFailure("NOT_FOUND");
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (isRetryableRecordConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    return recordFailure("INTERNAL_ERROR");
  } catch (error) { return recordError(error); }
}

export async function changeServiceRequestStatus(
  input: ChangeServiceRequestStatusInput,
): Promise<ServiceResponse<ServiceRequest>> {
  const parsed = changeServiceRequestStatusInputSchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          await assertRecordAccess(tx, session, workspace.id);
          const current = await tx.serviceRequest.findFirst({
            where: { id: parsed.data.id, workspaceId: workspace.id },
            select: { id: true, version: true, status: true },
          });
          if (!current) return recordFailure("NOT_FOUND");
          if (current.version !== parsed.data.expectedVersion) {
            await writeRequestAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
              requestId: current.id, action: "service_request.status_change", outcome: "DENIED", reason: "STALE_VERSION",
              fromStatus: current.status.toLowerCase() as ServiceRequestStatus, toStatus: parsed.data.status });
            return recordFailure("STALE_VERSION");
          }
          const currentStatus = current.status.toLowerCase() as ServiceRequestStatus;
          if (!canTransitionServiceRequestStatus(currentStatus, parsed.data.status)) {
            await writeRequestAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
              requestId: current.id, action: "service_request.status_change", outcome: "DENIED",
              reason: "INVALID_STATUS_TRANSITION", fromStatus: currentStatus, toStatus: parsed.data.status });
            return recordFailure("INVALID_STATUS_TRANSITION");
          }
          const updated = await tx.serviceRequest.updateMany({
            where: { id: current.id, workspaceId: workspace.id, version: current.version },
            data: { status: parsed.data.status.toUpperCase() as PrismaRequestStatus,
              updatedByUserId: session.user.id, version: { increment: 1 } },
          });
          if (updated.count !== 1) {
            await writeRequestAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
              requestId: current.id, action: "service_request.status_change", outcome: "DENIED", reason: "STALE_VERSION",
              fromStatus: currentStatus, toStatus: parsed.data.status });
            return recordFailure("STALE_VERSION");
          }
          await writeRequestAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
            requestId: current.id, action: "service_request.status_change", outcome: "SUCCEEDED",
            fromStatus: currentStatus, toStatus: parsed.data.status });
          const row = await tx.serviceRequest.findFirst({
            where: { id: current.id, workspaceId: workspace.id }, select: requestSelect,
          });
          return row ? { success: true as const, data: mapRequest(row) } : recordFailure("NOT_FOUND");
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (isRetryableRecordConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    return recordFailure("INTERNAL_ERROR");
  } catch (error) { return recordError(error); }
}

export async function deleteServiceRequest(
  input: DeleteServiceRequestInput,
): Promise<ServiceResponse<DeleteServiceRequestResult>> {
  const parsed = deleteServiceRequestInputSchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          await assertRecordAccess(tx, session, workspace.id);
          const current = await tx.serviceRequest.findFirst({
            where: { id: parsed.data.id, workspaceId: workspace.id },
            select: {
              id: true, version: true,
              creationOperation: { select: {
                plan: { select: { id: true, kind: true } },
                createdRequests: { select: { id: true }, take: 2 },
              } },
            },
          });
          if (!current) return recordFailure("NOT_FOUND");
          if (current.version !== parsed.data.expectedVersion) {
            await writeRequestAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
              requestId: current.id, action: "service_request.delete", outcome: "DENIED", reason: "STALE_VERSION" });
            return recordFailure("STALE_VERSION");
          }
          const deleted = await tx.serviceRequest.deleteMany({
            where: { id: current.id, workspaceId: workspace.id, version: current.version },
          });
          if (deleted.count !== 1) {
            await writeRequestAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
              requestId: current.id, action: "service_request.delete", outcome: "DENIED", reason: "STALE_VERSION" });
            return recordFailure("STALE_VERSION");
          }
          const plan = current.creationOperation.plan;
          const exclusiveManualPlan = plan?.kind === "MANUAL_REQUEST_CREATE" &&
            current.creationOperation.createdRequests.length === 1 &&
            current.creationOperation.createdRequests[0]?.id === current.id;
          if (plan && exclusiveManualPlan) {
            await tx.recordPlan.updateMany({
              where: { id: plan.id, workspaceId: workspace.id, kind: "MANUAL_REQUEST_CREATE" },
              data: { normalizedPayload: Prisma.DbNull, duplicateCandidates: Prisma.DbNull, payloadPurgedAt: new Date() },
            });
          }
          await writeRequestAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
            requestId: current.id, action: "service_request.delete", outcome: "SUCCEEDED" });
          return { success: true as const, data: { requestId: current.id } };
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (isRetryableRecordConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    return recordFailure("INTERNAL_ERROR");
  } catch (error) { return recordError(error); }
}
