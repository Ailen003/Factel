import "server-only";

import { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { resolveCurrentWorkspace } from "@/lib/auth/session";
import type { ServiceResponse } from "@/lib/api-responses";
import { assertRecordAccess, isRetryableRecordConflict, recordError, recordFailure } from "@/lib/records/record-policy";
import { hasExcludedSensitiveValues } from "@/lib/records/sensitive-submission-policy";
import { normalizeInternationalPhone } from "../../form/create/schemas/create-client-schema";
import { clientFiltersSchema, deleteClientInputSchema, editClientInputSchema, type Client, type ClientDuplicateCandidate, type ClientFiltersDto, type ClientsResponse, type DeleteClientInput, type DeleteClientResult, type EditClientInput } from "../types/client.types";

const clientSelect = {
  id: true, name: true, email: true, phone: true, company: true, address: true,
  notes: true, version: true, createdAt: true, updatedAt: true,
} satisfies Prisma.ClientSelect;
type SelectedClient = Prisma.ClientGetPayload<{ select: typeof clientSelect }>;
function mapClient(client: SelectedClient): Client {
  return { ...client, createdAt: client.createdAt.toISOString(), updatedAt: client.updatedAt.toISOString() };
}

export async function getAllClients(filters: ClientFiltersDto): Promise<ServiceResponse<ClientsResponse>> {
  const parsed = clientFiltersSchema.safeParse(filters);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  const input = parsed.data;
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    const where: Prisma.ClientWhereInput = { workspaceId: workspace.id,
      ...(input.search ? { OR: [
        { name: { contains: input.search, mode: "insensitive" } },
        { email: { contains: input.search, mode: "insensitive" } },
        { phone: { contains: input.search } },
        { company: { contains: input.search, mode: "insensitive" } },
      ] } : {}),
    };
    const order: Prisma.ClientOrderByWithRelationInput = { [input.sortBy]: input.sortOrder };
    return await prisma.$transaction(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      const total = await tx.client.count({ where });
      const totalPages = Math.max(1, Math.ceil(total / input.limit));
      const page = Math.min(input.page, totalPages);
      const rows = await tx.client.findMany({ where, select: clientSelect,
        orderBy: [order, { id: "asc" }], skip: (page - 1) * input.limit, take: input.limit });
      return { success: true as const, data: { clients: rows.map(mapClient),
        pagination: { page, limit: input.limit, total, totalPages } } };
    }, { isolationLevel: "RepeatableRead" });
  } catch (error) { return recordError(error); }
}

export async function getClientById(id: string): Promise<ServiceResponse<Client>> {
  if (typeof id !== "string" || !id.trim() || id.length > 191) return recordFailure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    return await prisma.$transaction(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      const row = await tx.client.findFirst({ where: { id, workspaceId: workspace.id }, select: clientSelect });
      return row ? { success: true as const, data: mapClient(row) } : recordFailure("NOT_FOUND");
    }, { isolationLevel: "RepeatableRead" });
  } catch (error) { return recordError(error); }
}

const duplicateSelect = {
  id: true, name: true, email: true, phone: true, company: true, version: true,
} satisfies Prisma.ClientSelect;

async function writeClientAudit(tx: Prisma.TransactionClient, input: {
  workspaceId: string; actorId: string; clientId: string; action: string;
  outcome: "SUCCEEDED" | "DENIED"; reason?: string; duplicateCount?: number;
}) {
  await tx.auditEvent.create({ data: {
    workspaceId: input.workspaceId, actorUserId: input.actorId,
    resourceType: "client", resourceId: input.clientId, action: input.action,
    outcome: input.outcome, correlationId: crypto.randomUUID(),
    safeMetadata: {
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.duplicateCount !== undefined ? { duplicateCount: input.duplicateCount } : {}),
    },
  } });
}

function normalizeEdit(input: EditClientInput) {
  return {
    name: input.client.name.trim(), email: input.client.email?.trim().toLowerCase() || null,
    phone: input.client.phone ? normalizeInternationalPhone(input.client.phone) : null,
    company: input.client.company?.trim() || null, address: input.client.address?.trim() || null,
    notes: input.client.notes?.trim() || null,
  };
}

export async function editClient(input: EditClientInput): Promise<ServiceResponse<Client>> {
  const parsed = editClientInputSchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  const next = normalizeEdit(parsed.data);
  if (hasExcludedSensitiveValues(next)) return recordFailure("SENSITIVE_DATA");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    return await prisma.$transaction(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      const current = await tx.client.findFirst({ where: { id: parsed.data.id, workspaceId: workspace.id },
        select: { ...clientSelect, normalizedEmail: true, normalizedPhone: true } });
      if (!current) return recordFailure("NOT_FOUND");
      if (current.version !== parsed.data.expectedVersion) {
        await writeClientAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
          clientId: current.id, action: "client.update", outcome: "DENIED", reason: "STALE_VERSION" });
        return recordFailure("STALE_VERSION");
      }
      const contactsChanged = current.normalizedEmail !== next.email || current.normalizedPhone !== next.phone;
      let duplicates: ClientDuplicateCandidate[] = [];
      if (contactsChanged) {
        const contacts: Prisma.ClientWhereInput[] = [];
        if (next.email) contacts.push({ normalizedEmail: next.email });
        if (next.phone) contacts.push({ normalizedPhone: next.phone });
        duplicates = await tx.client.findMany({ where: { workspaceId: workspace.id, id: { not: current.id }, OR: contacts },
          select: duplicateSelect, orderBy: { id: "asc" } });
        if (duplicates.length && !parsed.data.acknowledgeDuplicates) {
          await writeClientAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
            clientId: current.id, action: "client.update", outcome: "DENIED",
            reason: "DUPLICATE_ACKNOWLEDGMENT_REQUIRED", duplicateCount: duplicates.length });
          return recordFailure("DUPLICATE_ACKNOWLEDGMENT_REQUIRED", { duplicates });
        }
      }
      const updated = await tx.client.updateMany({ where: { id: current.id, workspaceId: workspace.id, version: current.version },
        data: { ...next, normalizedEmail: next.email, normalizedPhone: next.phone,
          updatedByUserId: session.user.id, version: { increment: 1 } } });
      if (updated.count !== 1) return recordFailure("STALE_VERSION");
      await tx.recordPlan.updateMany({ where: { workspaceId: workspace.id, selectedClientId: current.id, status: "PREPARED" },
        data: { status: "INVALIDATED", invalidatedAt: new Date() } });
      await writeClientAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
        clientId: current.id, action: "client.update", outcome: "SUCCEEDED", duplicateCount: duplicates.length });
      const row = await tx.client.findFirst({ where: { id: current.id, workspaceId: workspace.id }, select: clientSelect });
      return row ? { success: true as const, data: mapClient(row) } : recordFailure("NOT_FOUND");
    }, { isolationLevel: "Serializable" });
  } catch (error) { return recordError(error); }
}

export async function deleteClient(input: DeleteClientInput): Promise<ServiceResponse<DeleteClientResult>> {
  const parsed = deleteClientInputSchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          await assertRecordAccess(tx, session, workspace.id);
          const current = await tx.client.findFirst({ where: { id: parsed.data.id, workspaceId: workspace.id },
            select: { id: true, version: true, creationOperation: { select: { planId: true } } } });
          if (!current) return recordFailure("NOT_FOUND");
          if (current.version !== parsed.data.expectedVersion) {
            await writeClientAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
              clientId: current.id, action: "client.delete", outcome: "DENIED", reason: "STALE_VERSION" });
            return recordFailure("STALE_VERSION");
          }
          const requestCount = await tx.serviceRequest.count({ where: { workspaceId: workspace.id, clientId: current.id } });
          if (requestCount > 0) {
            await writeClientAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
              clientId: current.id, action: "client.delete", outcome: "DENIED", reason: "CLIENT_HAS_REQUESTS" });
            return recordFailure("CLIENT_HAS_REQUESTS", { requestCount });
          }
          const now = new Date();
          await tx.recordPlan.updateMany({ where: { workspaceId: workspace.id, selectedClientId: current.id, status: "PREPARED" },
            data: { status: "INVALIDATED", invalidatedAt: now, selectedClientId: null, selectedClientVersion: null } });
          await tx.recordPlan.updateMany({ where: { workspaceId: workspace.id, selectedClientId: current.id },
            data: { selectedClientId: null, selectedClientVersion: null } });
          await tx.operationReceipt.updateMany({ where: { workspaceId: workspace.id, selectedClientId: current.id },
            data: { selectedClientId: null } });
          if (current.creationOperation.planId) {
            await tx.recordPlan.updateMany({ where: { id: current.creationOperation.planId, workspaceId: workspace.id },
              data: { normalizedPayload: Prisma.DbNull, duplicateCandidates: Prisma.DbNull, payloadPurgedAt: now } });
          }
          const deleted = await tx.client.deleteMany({ where: { id: current.id, workspaceId: workspace.id, version: current.version } });
          if (deleted.count !== 1) return recordFailure("STALE_VERSION");
          await writeClientAudit(tx, { workspaceId: workspace.id, actorId: session.user.id,
            clientId: current.id, action: "client.delete", outcome: "SUCCEEDED" });
          return { success: true as const, data: { clientId: current.id } };
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (isRetryableRecordConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    return recordFailure("INTERNAL_ERROR");
  } catch (error) { return recordError(error); }
}
