import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma, RecordPlan, OperationReceipt } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { resolveCurrentWorkspace } from "@/lib/auth/session";
import type { ServiceResponse } from "@/lib/api-responses";
import type { ClientDuplicateCandidate } from "@/modules/clients/lib/types/client.types";
import { normalizeRequestDraft } from "@/modules/requests/lib/types/service-request.types";
import { createServiceRequestSchema } from "@/modules/requests/form/create/schemas/create-service-request-schema";
import { proposalDraftSchema, type ProposalFinding } from "@/modules/conversations/lib/types/proposal.types";
import { canPrepareProposal, hasSensitiveDraft, ProposalValidationError, validateProposalDraft } from "@/modules/conversations/lib/validation/proposal-validation";
import {
  conversationCreationQuerySchema, conversationClientChoiceSchema, prepareConversationCreationSchema,
  confirmConversationCreationSchema, abandonConversationCreationSchema,
  type ConversationCreationState, type ConversationCreationPreview, type ConversationCreationResult,
  type PrepareConversationCreationInput, type ConfirmConversationCreationInput, type AbandonConversationCreationInput,
} from "@/modules/conversations/lib/types/conversation-creation.types";
import { assertRecordAccess, isRetryableRecordConflict, recordError, recordFailure } from "./record-policy";
import { findClientDuplicates, normalizeClientDraft, writeClientRecord, writeRequestRecord } from "./record-writes";

const PLAN_TTL_MS = 15 * 60 * 1000;
const clientSchema = z.object({ name: z.string(), email: z.string().nullable(), phone: z.string().nullable(),
  company: z.string().nullable(), address: z.string().nullable(), notes: z.string().nullable() }).strict();
function clientValues(client: z.infer<typeof clientSchema>) {
  return { name: client.name, email: client.email, phone: client.phone, company: client.company, address: client.address, notes: client.notes };
}
const duplicatesSchema = z.array(z.object({ id: z.string(), version: z.number().int().positive(), name: z.string(),
  email: z.string().nullable(), phone: z.string().nullable(), company: z.string().nullable() }).strict());
const payloadSchema = z.object({ conversationVersion: z.number().int().positive(), choice: conversationClientChoiceSchema,
  proposedClient: clientSchema, client: clientSchema,
  requests: z.array(z.object({ stableItemId: z.string(), title: z.string(), description: z.string(),
    serviceType: z.enum(["installation", "repair", "maintenance", "inspection", "other"]), priority: z.enum(["low", "normal", "high"]),
    preferredSchedule: z.string().nullable(), serviceAddress: z.string().nullable(), nextSteps: z.string().nullable(),
    status: z.literal("pending") }).strict()).min(1).max(50),
}).strict();
type Payload = z.infer<typeof payloadSchema>;
const conversationSelect = { id: true, workspaceId: true, version: true, status: true,
  currentProposalRevisionId: true, completedOperationId: true } satisfies Prisma.ConversationSelect;
type Conversation = Prisma.ConversationGetPayload<{ select: typeof conversationSelect }>;
const revisionSelect = { id: true, readyAt: true, status: true, sealedAt: true, validationSummary: true,
  clientDraft: { select: { name: true, email: true, phone: true, company: true, address: true, notes: true } },
  requestItems: { select: { stableItemId: true, title: true, description: true, serviceType: true, priority: true,
    preferredSchedule: true, serviceAddress: true, nextSteps: true }, orderBy: { displayOrder: "asc" } },
} satisfies Prisma.ProposalRevisionSelect;

function failure(error: unknown, uncertain = false) {
  return error instanceof ProposalValidationError ? recordFailure(error.code) : recordError(error, uncertain);
}
async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: "Serializable", timeout: 20000 }); }
    catch (error) { if (attempt >= 2 || !isRetryableRecordConflict(error)) throw error; }
  }
}
function receiptKey(workspaceId: string, conversationId: string) {
  return `conversation-batch:${workspaceId}:${conversationId}`;
}
function hashPlan(plan: Pick<RecordPlan, "workspaceId" | "createdByUserId" | "sourceConversationId" | "sourceRevisionId" |
  "operationIntent" | "expiresAt" | "selectedClientId" | "selectedClientVersion" | "duplicateDecision">,
  payload: Payload, duplicates: ClientDuplicateCandidate[]) {
  // Fixed field order is deliberate: JSONB does not preserve object-key ordering.
  return createHash("sha256").update(JSON.stringify({ kind: "CONVERSATION_BATCH_CREATE", version: 1,
    workspaceId: plan.workspaceId, actorId: plan.createdByUserId, conversationId: plan.sourceConversationId,
    revisionId: plan.sourceRevisionId, operationIntent: plan.operationIntent, expiresAt: plan.expiresAt.toISOString(),
    selectedClientId: plan.selectedClientId, selectedClientVersion: plan.selectedClientVersion,
    duplicateDecision: plan.duplicateDecision, payload: payloadSchema.parse(payload), duplicates: duplicatesSchema.parse(duplicates),
  })).digest("hex");
}
async function loadConversation(tx: Prisma.TransactionClient, id: string, workspaceId: string) {
  const conversation = await tx.conversation.findFirst({ where: { id, workspaceId, deletionState: "ACTIVE" }, select: conversationSelect });
  if (!conversation) throw new ProposalValidationError("NOT_FOUND");
  return conversation;
}
async function readyDraft(tx: Prisma.TransactionClient, conversation: Conversation) {
  if (!conversation.currentProposalRevisionId) throw new ProposalValidationError("PROPOSAL_NOT_READY");
  const revision = await tx.proposalRevision.findFirst({ where: { id: conversation.currentProposalRevisionId,
    workspaceId: conversation.workspaceId, conversationId: conversation.id }, select: revisionSelect });
  if (!revision?.clientDraft || !revision.sealedAt || !revision.readyAt || revision.status !== "READY") {
    throw new ProposalValidationError("PROPOSAL_NOT_READY");
  }
  const draft = proposalDraftSchema.safeParse({ client: Object.fromEntries(Object.entries(revision.clientDraft).map(([key, value]) => [key, value ?? ""])),
    requests: revision.requestItems.map((item) => ({ ...Object.fromEntries(Object.entries(item).map(([key, value]) => [key, value ?? ""])),
      serviceType: item.serviceType?.toLowerCase() ?? "", priority: item.priority?.toLowerCase() ?? "" })) });
  const summary = revision.validationSummary as { findings?: ProposalFinding[] } | null;
  if (!draft.success || !Array.isArray(summary?.findings) ||
      !canPrepareProposal([...validateProposalDraft(draft.data), ...summary.findings]) || hasSensitiveDraft(draft.data)) {
    throw new ProposalValidationError("PROPOSAL_NOT_READY");
  }
  return { proposedClient: normalizeClientDraft(draft.data.client),
    requests: draft.data.requests.map(({ stableItemId, ...request }) => ({ stableItemId,
      ...normalizeRequestDraft(createServiceRequestSchema.parse({ ...request, clientId: "proposal-client" })), status: "pending" as const })) };
}
function resultFromReceipt(receipt: OperationReceipt, conversationId: string, replayed: boolean): ConversationCreationResult {
  const ids = z.array(z.string()).min(1).max(50).safeParse(receipt.resultRequestIds);
  if (receipt.outcome !== "SUCCEEDED" || !receipt.completedAt || !ids.success) throw new ProposalValidationError("CONFIRMATION_UNCERTAIN");
  return { operationId: receipt.id, conversationId, clientId: receipt.selectedClientId,
    requestIds: ids.data, completedAt: receipt.completedAt.toISOString(), replayed };
}
async function existingResult(tx: Prisma.TransactionClient, conversation: Conversation, actorId: string) {
  const receipt = await tx.operationReceipt.findFirst({ where: { workspaceId: conversation.workspaceId,
    idempotencyKey: receiptKey(conversation.workspaceId, conversation.id), actorUserId: actorId } });
  if (receipt) return resultFromReceipt(receipt, conversation.id, true);
  if (conversation.completedOperationId || conversation.status === "COMPLETED") throw new ProposalValidationError("CONFIRMATION_UNCERTAIN");
  return null;
}
function previewFromPlan(plan: RecordPlan): ConversationCreationPreview | null {
  const parsed = payloadSchema.safeParse(plan.normalizedPayload);
  const duplicates = duplicatesSchema.safeParse(plan.duplicateCandidates);
  if (!parsed.success || !duplicates.success || !plan.sourceConversationId || !plan.sourceRevisionId) return null;
  const payload = parsed.data;
  if (hashPlan(plan, payload, duplicates.data) !== plan.planHash) return null;
  return { planId: plan.id, planHash: plan.planHash, expiresAt: plan.expiresAt.toISOString(),
    conversationId: plan.sourceConversationId, revisionId: plan.sourceRevisionId, version: payload.conversationVersion,
    choice: payload.choice, client: payload.client, duplicates: duplicates.data, requests: payload.requests };
}
async function state(tx: Prisma.TransactionClient, conversation: Conversation, actorId: string): Promise<ConversationCreationState> {
  const result = await existingResult(tx, conversation, actorId);
  const base = { conversationId: conversation.id, version: conversation.version, revisionId: conversation.currentProposalRevisionId,
    status: conversation.status.toLowerCase(), result };
  if (result || !["READY", "RECORD_PLAN_PENDING"].includes(conversation.status)) return { ...base, duplicates: [], preview: null };
  const draft = await readyDraft(tx, conversation);
  const duplicates = await findClientDuplicates(tx, conversation.workspaceId, draft.proposedClient);
  const plan = await tx.recordPlan.findFirst({ where: { workspaceId: conversation.workspaceId, createdByUserId: actorId,
    sourceConversationId: conversation.id, sourceRevisionId: conversation.currentProposalRevisionId,
    kind: "CONVERSATION_BATCH_CREATE", status: "PREPARED" }, orderBy: { createdAt: "desc" } });
  return { ...base, duplicates, preview: plan ? previewFromPlan(plan) : null };
}
async function audit(tx: Prisma.TransactionClient, workspaceId: string, actorId: string, conversationId: string,
  operationIntent: string, action: string, metadata: Prisma.InputJsonObject = {}) {
  await tx.auditEvent.create({ data: { workspaceId, actorUserId: actorId, resourceType: "conversation", resourceId: conversationId,
    correlationId: operationIntent, action, outcome: "SUCCEEDED", safeMetadata: { kind: "CONVERSATION_BATCH_CREATE", ...metadata } } });
}

export async function getConversationCreationState(input: { conversationId: string }): Promise<ServiceResponse<ConversationCreationState>> {
  const parsed = conversationCreationQuerySchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    const data = await prisma.$transaction(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      return state(tx, await loadConversation(tx, parsed.data.conversationId, workspace.id), session.user.id);
    }, { isolationLevel: "RepeatableRead" });
    return { success: true, data };
  } catch (error) { return failure(error); }
}

export async function prepareConversationCreation(input: PrepareConversationCreationInput): Promise<ServiceResponse<ConversationCreationState>> {
  const parsed = prepareConversationCreationSchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  const values = parsed.data;
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    const data = await serializable(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      const conversation = await loadConversation(tx, values.conversationId, workspace.id);
      if (await existingResult(tx, conversation, session.user.id)) return state(tx, conversation, session.user.id);
      if (conversation.version !== values.expectedVersion || conversation.currentProposalRevisionId !== values.revisionId) throw new ProposalValidationError("STALE_VERSION");
      if (!["READY", "RECORD_PLAN_PENDING"].includes(conversation.status)) throw new ProposalValidationError("PROPOSAL_NOT_READY");
      const draft = await readyDraft(tx, conversation);
      const duplicates = await findClientDuplicates(tx, workspace.id, draft.proposedClient);
      const selected = values.choice.kind === "existing" ? await tx.client.findFirst({ where: {
        id: values.choice.clientId, workspaceId: workspace.id }, select: { id: true, version: true, name: true,
        email: true, phone: true, company: true, address: true, notes: true } }) : null;
      if (values.choice.kind === "existing" && (!selected || !duplicates.some((item) => item.id === selected.id))) throw new ProposalValidationError("CLIENT_CHANGED");
      const payload: Payload = { conversationVersion: conversation.version + 1, choice: values.choice, ...draft,
        client: selected ? clientValues(selected) : draft.proposedClient };
      const planData = { workspaceId: workspace.id, createdByUserId: session.user.id, kind: "CONVERSATION_BATCH_CREATE" as const,
        sourceConversationId: conversation.id, sourceRevisionId: values.revisionId, operationIntent: randomUUID(),
        expiresAt: new Date(Date.now() + PLAN_TTL_MS), selectedClientId: selected?.id ?? null, selectedClientVersion: selected?.version ?? null,
        duplicateDecision: selected ? "REUSE_EXISTING" : duplicates.length ? "CREATE_DISTINCT" : "NO_MATCHES" };
      const changed = await tx.conversation.updateMany({ where: { id: conversation.id, workspaceId: workspace.id,
        version: values.expectedVersion, deletionState: "ACTIVE", completedOperationId: null, currentProposalRevisionId: values.revisionId },
        data: { status: "RECORD_PLAN_PENDING", version: { increment: 1 } } });
      if (changed.count !== 1) throw new ProposalValidationError("STALE_VERSION");
      await tx.recordPlan.updateMany({ where: { workspaceId: workspace.id, sourceConversationId: conversation.id,
        status: { in: ["PREPARED", "APPROVED"] } }, data: { status: "INVALIDATED", invalidatedAt: new Date() } });
      const plan = await tx.recordPlan.create({ data: { ...planData, normalizedPayload: payload,
        duplicateCandidates: duplicates, planHash: hashPlan(planData, payload, duplicates) } });
      await audit(tx, workspace.id, session.user.id, conversation.id, plan.operationIntent, "conversation.record_plan.prepared", { requestCount: payload.requests.length });
      return { conversationId: conversation.id, version: payload.conversationVersion, revisionId: values.revisionId,
        status: "record_plan_pending", duplicates, preview: previewFromPlan(plan), result: null };
    });
    return { success: true, data };
  } catch (error) { return failure(error); }
}

export async function abandonConversationCreation(input: AbandonConversationCreationInput): Promise<ServiceResponse<ConversationCreationState>> {
  const parsed = abandonConversationCreationSchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    const data = await serializable(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      const conversation = await loadConversation(tx, parsed.data.conversationId, workspace.id);
      if (await existingResult(tx, conversation, session.user.id)) return state(tx, conversation, session.user.id);
      if (conversation.version !== parsed.data.expectedVersion) throw new ProposalValidationError("STALE_VERSION");
      if (conversation.status !== "RECORD_PLAN_PENDING") throw new ProposalValidationError("INVALID_STATUS_TRANSITION");
      const changed = await tx.conversation.updateMany({ where: { id: conversation.id, workspaceId: workspace.id,
        version: conversation.version, deletionState: "ACTIVE", completedOperationId: null }, data: { status: "READY", version: { increment: 1 } } });
      if (changed.count !== 1) throw new ProposalValidationError("STALE_VERSION");
      await tx.recordPlan.updateMany({ where: { workspaceId: workspace.id, sourceConversationId: conversation.id,
        status: { in: ["PREPARED", "APPROVED"] } }, data: { status: "INVALIDATED", invalidatedAt: new Date() } });
      await audit(tx, workspace.id, session.user.id, conversation.id, randomUUID(), "conversation.record_plan.abandoned");
      return state(tx, { ...conversation, version: conversation.version + 1, status: "READY" }, session.user.id);
    });
    return { success: true, data };
  } catch (error) { return failure(error); }
}

export async function confirmConversationCreation(input: ConfirmConversationCreationInput): Promise<ServiceResponse<ConversationCreationResult>> {
  const parsed = confirmConversationCreationSchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    return await serializable(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      const plan = await tx.recordPlan.findFirst({ where: { id: parsed.data.planId, workspaceId: workspace.id,
        createdByUserId: session.user.id, kind: "CONVERSATION_BATCH_CREATE" }, include: { approvals: true } });
      if (!plan?.sourceConversationId) return recordFailure("NOT_FOUND");
      if (plan.planHash !== parsed.data.planHash) return recordFailure("PLAN_STALE");
      // The receipt belongs to the conversation, not a particular preview. Reconcile before all freshness checks.
      // Source deletion purges proposal content but cannot erase an already committed result.
      const committed = await tx.operationReceipt.findFirst({ where: { workspaceId: workspace.id,
        idempotencyKey: receiptKey(workspace.id, plan.sourceConversationId), actorUserId: session.user.id } });
      if (committed) return { success: true as const, data: resultFromReceipt(committed, plan.sourceConversationId, true) };
      const conversation = await loadConversation(tx, plan.sourceConversationId, workspace.id);
      const replay = await existingResult(tx, conversation, session.user.id);
      if (replay) return { success: true as const, data: replay };
      const deny = async (code: string, invalidate = true) => {
        if (invalidate) await tx.recordPlan.update({ where: { id: plan.id, workspaceId: workspace.id },
          data: { status: code === "PLAN_EXPIRED" ? "EXPIRED" : "INVALIDATED", invalidatedAt: new Date() } });
        await tx.auditEvent.create({ data: { workspaceId: workspace.id, actorUserId: session.user.id,
          resourceType: "record_plan", resourceId: plan.id, action: "conversation.record_plan.confirm", outcome: "DENIED",
          correlationId: plan.operationIntent, safeMetadata: { reason: code, kind: "CONVERSATION_BATCH_CREATE" } } });
        return recordFailure(code);
      };
      if (plan.status !== "PREPARED" || plan.planVersion !== 1 || plan.approvals.length) return deny("PLAN_STALE", false);
      if (plan.expiresAt.getTime() <= Date.now()) return deny("PLAN_EXPIRED");
      const preview = previewFromPlan(plan);
      if (!preview || conversation.status !== "RECORD_PLAN_PENDING" || conversation.version !== preview.version ||
          conversation.currentProposalRevisionId !== preview.revisionId) return deny("PLAN_STALE");
      const payload = payloadSchema.parse(plan.normalizedPayload);
      const draft = await readyDraft(tx, conversation);
      if (JSON.stringify(draft.proposedClient) !== JSON.stringify(payload.proposedClient) ||
          JSON.stringify(draft.requests) !== JSON.stringify(payload.requests)) return deny("PLAN_STALE");
      const duplicates = await findClientDuplicates(tx, workspace.id, draft.proposedClient);
      if (JSON.stringify(duplicatesSchema.parse(duplicates)) !== JSON.stringify(preview.duplicates)) return deny("DUPLICATES_CHANGED");
      let clientId: string | null = null;
      if (payload.choice.kind === "existing") {
        const selected = await tx.client.findFirst({ where: { id: payload.choice.clientId, workspaceId: workspace.id },
          select: { id: true, version: true, name: true, email: true, phone: true, company: true, address: true, notes: true } });
        if (!selected || selected.id !== plan.selectedClientId || selected.version !== plan.selectedClientVersion ||
            !duplicates.some((candidate) => candidate.id === selected.id) ||
            JSON.stringify(clientValues(selected)) !== JSON.stringify(payload.client)) return deny("CLIENT_CHANGED");
        clientId = selected.id;
      } else {
        if (plan.selectedClientId || plan.selectedClientVersion !== null ||
            JSON.stringify(payload.client) !== JSON.stringify(draft.proposedClient)) return deny("PLAN_STALE");
        if (duplicates.length && !parsed.data.acknowledgeDuplicates) return deny("DUPLICATE_ACKNOWLEDGMENT_REQUIRED", false);
      }
      await tx.recordApproval.create({ data: { workspaceId: workspace.id, planId: plan.id, planHash: plan.planHash,
        userId: session.user.id, decision: "APPROVED", expiresAt: plan.expiresAt } });
      const receipt = await tx.operationReceipt.create({ data: { workspaceId: workspace.id, planId: plan.id,
        operationIntent: plan.operationIntent, idempotencyKey: receiptKey(workspace.id, conversation.id), origin: "CONVERSATION",
        actorUserId: session.user.id, sourceConversationId: conversation.id, sourceRevisionId: preview.revisionId,
        selectedClientId: clientId }, select: { id: true } });
      const context = { workspaceId: workspace.id, actorId: session.user.id, operationId: receipt.id };
      if (!clientId) clientId = (await writeClientRecord(tx, context, payload.client)).id;
      const requestIds: string[] = [];
      for (const { stableItemId, status: _status, ...request } of payload.requests) {
        requestIds.push((await writeRequestRecord(tx, { ...context, clientId }, request, stableItemId)).id);
      }
      const completedAt = new Date();
      await tx.operationReceipt.update({ where: { id: receipt.id, workspaceId: workspace.id },
        data: { selectedClientId: clientId, outcome: "SUCCEEDED", completedAt, resultRequestIds: requestIds } });
      const changed = await tx.conversation.updateMany({ where: { id: conversation.id, workspaceId: workspace.id,
        status: "RECORD_PLAN_PENDING", version: preview.version, currentProposalRevisionId: preview.revisionId,
        completedOperationId: null, deletionState: "ACTIVE" }, data: { status: "COMPLETED", completedOperationId: receipt.id, version: { increment: 1 } } });
      if (changed.count !== 1) throw new ProposalValidationError("STALE_VERSION");
      await tx.recordPlan.update({ where: { id: plan.id, workspaceId: workspace.id }, data: { status: "COMMITTED" } });
      await tx.recordPlan.updateMany({ where: { workspaceId: workspace.id, sourceConversationId: conversation.id,
        id: { not: plan.id }, status: { in: ["PREPARED", "APPROVED"] } }, data: { status: "INVALIDATED", invalidatedAt: completedAt } });
      await audit(tx, workspace.id, session.user.id, conversation.id, plan.operationIntent, "conversation.records.created",
        { revisionId: preview.revisionId, operationId: receipt.id, requestCount: requestIds.length });
      return { success: true as const, data: { operationId: receipt.id, conversationId: conversation.id,
        clientId, requestIds, completedAt: completedAt.toISOString(), replayed: false } };
    });
  } catch (error) { return failure(error, true); }
}
