import "server-only";

import type { Prisma, RequestPriority, ServiceType } from "@/lib/persistence/generated/client";
import { normalizeInternationalPhone } from "@/modules/clients/form/create/schemas/create-client-schema";
import type { ClientCreationDraft, CreateClientDto } from "@/modules/clients/lib/types/client.types";
import type { ServiceRequestDraft } from "@/modules/requests/lib/types/service-request.types";

export function normalizeClientDraft(dto: CreateClientDto): ClientCreationDraft {
  return { name: dto.name.trim(), email: dto.email?.trim().toLowerCase() || null,
    phone: dto.phone ? normalizeInternationalPhone(dto.phone) : null, company: dto.company?.trim() || null,
    address: dto.address?.trim() || null, notes: dto.notes?.trim() || null };
}

export async function findClientDuplicates(tx: Prisma.TransactionClient, workspaceId: string, client: ClientCreationDraft) {
  const contacts: Prisma.ClientWhereInput[] = [];
  if (client.email) contacts.push({ normalizedEmail: client.email });
  if (client.phone) contacts.push({ normalizedPhone: client.phone });
  return tx.client.findMany({ where: { workspaceId, OR: contacts },
    select: { id: true, name: true, email: true, phone: true, company: true, version: true }, orderBy: { id: "asc" } });
}

interface WriteContext { workspaceId: string; actorId: string; operationId: string }
export async function writeClientRecord(tx: Prisma.TransactionClient, context: WriteContext, client: ClientCreationDraft) {
  return tx.client.create({ data: { ...client, workspaceId: context.workspaceId,
    normalizedEmail: client.email, normalizedPhone: client.phone, creationOperationId: context.operationId,
    createdByUserId: context.actorId, updatedByUserId: context.actorId }, select: { id: true } });
}

export async function writeRequestRecord(tx: Prisma.TransactionClient, context: WriteContext & { clientId: string },
  request: ServiceRequestDraft, sourceProposalItemId?: string) {
  return tx.serviceRequest.create({ data: { ...request, serviceType: request.serviceType.toUpperCase() as ServiceType,
    priority: request.priority.toUpperCase() as RequestPriority, status: "PENDING", workspaceId: context.workspaceId,
    clientId: context.clientId, creationOperationId: context.operationId, createdByUserId: context.actorId,
    updatedByUserId: context.actorId, ...(sourceProposalItemId ? { sourceProposalItemId } : {}) }, select: { id: true } });
}
