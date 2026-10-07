import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { resolveCurrentWorkspace } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/types";
import type { ServiceResponse } from "@/lib/api-responses";
import { assertRecordAccess, isRetryableRecordConflict, recordFailure } from "@/lib/records/record-policy";
import { hasExcludedSensitiveValues } from "@/lib/records/sensitive-submission-policy";
import {
  clientFieldKeys, reviewQuerySchema, historyQuerySchema, saveProposalRevisionSchema, markProposalReadySchema, isPersistentFinding, isResolvableFinding,
  type ConversationReview, type ProposalHistory, type ProposalRevisionView, type ProposalField, type ProposalFinding,
  resolveReprocessingCandidateSchema, type ResolveReprocessingCandidateInput,
  type SaveProposalRevisionInput, type MarkProposalReadyInput, type ValidatedExtraction,
} from "../types/proposal.types";
import {
  ProposalValidationError, normalizeProposalDraft, validateProposalDraft, validateExtraction, hasSensitiveDraft,
  draftFields, fieldIdentity, canPrepareProposal,
} from "../validation/proposal-validation";
import { adoptReprocessingSelection } from "../validation/reprocessing-adoption";

const revisionSelect = {
  id: true, workspaceId: true, conversationId: true, revisionNumber: true, parentRevisionId: true,
  producingRunId: true, transcriptId: true, diarizationVersionId: true, schemaVersion: true,
  taskProfileVersion: true, promptVersion: true, policyVersion: true, authorKind: true,
  createdAt: true, readyAt: true, sealedAt: true, validationSummary: true, inputFingerprint: true,
  authorUser: { select: { name: true } }, readyByUser: { select: { name: true } },
  clientDraft: { select: { name: true, email: true, phone: true, company: true, address: true, notes: true } },
  requestItems: { select: { stableItemId: true, title: true, description: true, serviceType: true, priority: true,
    preferredSchedule: true, serviceAddress: true, nextSteps: true }, orderBy: { displayOrder: "asc" } },
  fields: { select: { target: true, fieldKey: true, observedValue: true, normalizedValue: true, provenance: true, confidence: true,
    requestItem: { select: { stableItemId: true } }, evidenceLinks: { select: { evidence: { select: { stableEvidenceId: true } } } } } },
} satisfies Prisma.ProposalRevisionSelect;
type Revision = Prisma.ProposalRevisionGetPayload<{ select: typeof revisionSelect }>;
const conversationSelect = { id: true, workspaceId: true, version: true, status: true, currentProposalRevisionId: true,
  deletionState: true, completedOperationId: true, correlationId: true, currentRunId: true } satisfies Prisma.ConversationSelect;
type Conversation = Prisma.ConversationGetPayload<{ select: typeof conversationSelect }>;

function errorResponse(error: unknown): ServiceResponse<never> {
  if (error instanceof AuthError || error instanceof ProposalValidationError) return recordFailure(error.code);
  console.error("Proposal operation failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
  return recordFailure("INTERNAL_ERROR");
}
async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: "Serializable", timeout: 20000 }); }
    catch (error) { if (attempt >= 2 || !isRetryableRecordConflict(error)) throw error; }
  }
}
function revisionView(row: Revision): ProposalRevisionView {
  const metadata = row.validationSummary as { findings?: ProposalFinding[] } | null;
  const findings = metadata?.findings ?? [];
  return {
    id: row.id, revisionNumber: row.revisionNumber, parentRevisionId: row.parentRevisionId,
    authorKind: row.authorKind === "HUMAN" ? "human" : "extraction", authorName: row.authorUser?.name ?? null,
    createdAt: row.createdAt.toISOString(), readyAt: row.readyAt?.toISOString() ?? null, readyByName: row.readyByUser?.name ?? null,
    draft: {
      client: { name: row.clientDraft?.name ?? "", email: row.clientDraft?.email ?? "", phone: row.clientDraft?.phone ?? "",
        company: row.clientDraft?.company ?? "", address: row.clientDraft?.address ?? "", notes: row.clientDraft?.notes ?? "" },
      requests: row.requestItems.map((item) => ({ stableItemId: item.stableItemId, title: item.title ?? "", description: item.description ?? "",
        serviceType: item.serviceType?.toLowerCase() as "installation" | "repair" | "maintenance" | "inspection" | "other" ?? "",
        priority: item.priority?.toLowerCase() as "low" | "normal" | "high" ?? "",
        preferredSchedule: item.preferredSchedule ?? "", serviceAddress: item.serviceAddress ?? "", nextSteps: item.nextSteps ?? "" })),
    },
    fields: row.fields.map((field) => ({ target: field.target === "CLIENT" ? "client" : "request",
      itemId: field.requestItem?.stableItemId ?? null, fieldKey: field.fieldKey as ProposalField["fieldKey"],
      observedValue: field.observedValue, normalizedValue: field.normalizedValue,
      provenance: field.provenance.toLowerCase() as ProposalField["provenance"], confidence: field.confidence === null ? null : Number(field.confidence),
      evidenceIds: field.evidenceLinks.map((link) => link.evidence.stableEvidenceId) })),
    findings, canMarkReady: row.sealedAt !== null && canPrepareProposal(findings),
  };
}
async function reviewResult(tx: Prisma.TransactionClient, conversation: Conversation, revisionId?: string): Promise<ConversationReview> {
  const requested = revisionId ?? conversation.currentProposalRevisionId;
  const row = requested ? await tx.proposalRevision.findFirst({
    where: { id: requested, conversationId: conversation.id, workspaceId: conversation.workspaceId, sealedAt: { not: null } }, select: revisionSelect,
  }) : null;
  if (requested && !row) throw new ProposalValidationError("NOT_FOUND");
  const candidate = await getPendingReprocessingCandidate(tx, conversation);
  return { conversationId: conversation.id, version: conversation.version, status: conversation.status.toLowerCase(),
    currentRevisionId: conversation.currentProposalRevisionId, revision: row ? revisionView(row) : null,
    candidate: candidate ? revisionView(candidate) : null };
}
export async function getPendingReprocessingCandidate(tx: Prisma.TransactionClient,
  conversation: { id: string; workspaceId: string; currentRunId: string | null; currentProposalRevisionId: string | null }) {
  if (!conversation.currentRunId || !conversation.currentProposalRevisionId) return null;
  return tx.proposalRevision.findFirst({ where: { workspaceId: conversation.workspaceId, conversationId: conversation.id,
    producingRunId: conversation.currentRunId, authorKind: "EXTRACTION", parentRevisionId: conversation.currentProposalRevisionId,
    status: "CANDIDATE", sealedAt: { not: null }, id: { not: conversation.currentProposalRevisionId } }, select: revisionSelect });
}
async function nextRevisionNumber(tx: Prisma.TransactionClient, conversation: { id: string; workspaceId: string }) {
  const latest = await tx.proposalRevision.findFirst({ where: { conversationId: conversation.id, workspaceId: conversation.workspaceId },
    select: { revisionNumber: true }, orderBy: { revisionNumber: "desc" } });
  return (latest?.revisionNumber ?? 0) + 1;
}
async function loadConversation(tx: Prisma.TransactionClient, id: string, workspaceId: string) {
  const conversation = await tx.conversation.findFirst({ where: { id, workspaceId, deletionState: "ACTIVE" }, select: conversationSelect });
  if (!conversation) throw new ProposalValidationError("NOT_FOUND");
  return conversation;
}
export async function getConversationReview(input: { conversationId: string; revisionId?: string }): Promise<ServiceResponse<ConversationReview>> {
  const parsed = reviewQuerySchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    const data = await prisma.$transaction(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      const conversation = await loadConversation(tx, parsed.data.conversationId, workspace.id);
      return reviewResult(tx, conversation, parsed.data.revisionId);
    }, { isolationLevel: "RepeatableRead" });
    return { success: true, data };
  } catch (error) { return errorResponse(error); }
}
export async function getProposalHistory(input: { conversationId: string; cursor?: string }): Promise<ServiceResponse<ProposalHistory>> {
  const parsed = historyQuerySchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    const data = await prisma.$transaction(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      await loadConversation(tx, parsed.data.conversationId, workspace.id);
      const where = { conversationId: parsed.data.conversationId, workspaceId: workspace.id, sealedAt: { not: null } };
      const cursor = parsed.data.cursor ? await tx.proposalRevision.findFirst({ where: { ...where, id: parsed.data.cursor }, select: { revisionNumber: true } }) : null;
      if (parsed.data.cursor && !cursor) throw new ProposalValidationError("NOT_FOUND");
      const rows = await tx.proposalRevision.findMany({ where: { ...where, ...(cursor ? { revisionNumber: { lt: cursor.revisionNumber } } : {}) },
        select: { id: true, revisionNumber: true, authorKind: true, authorUser: { select: { name: true } }, createdAt: true, readyAt: true },
        orderBy: { revisionNumber: "desc" }, take: 21 });
      return { revisions: rows.slice(0, 20).map((row) => ({ id: row.id, revisionNumber: row.revisionNumber,
        authorKind: row.authorKind === "HUMAN" ? "human" as const : "extraction" as const,
        authorName: row.authorUser?.name ?? null, createdAt: row.createdAt.toISOString(), readyAt: row.readyAt?.toISOString() ?? null })),
      nextCursor: rows.length > 20 ? rows[19]!.id : null };
    }, { isolationLevel: "RepeatableRead" });
    return { success: true, data };
  } catch (error) { return errorResponse(error); }
}

interface PersistRevision {
  id: string; workspaceId: string; conversationId: string; revisionNumber: number; parentRevisionId: string | null;
  producingRunId: string | null; transcriptId: string; diarizationVersionId: string | null;
  authorUserId: string | null; operationKey: string; inputFingerprint?: string;
  output: ValidatedExtraction;
}
async function persistRevision(tx: Prisma.TransactionClient, input: PersistRevision): Promise<void> {
  const { output, id: revisionId, workspaceId } = input;
  const evidence = await tx.transcriptEvidence.findMany({ where: { transcriptId: input.transcriptId, workspaceId }, select: { id: true, stableEvidenceId: true } });
  const evidenceMap = new Map(evidence.map((entry) => [entry.stableEvidenceId, entry.id]));
  await tx.proposalRevision.create({ data: {
    id: revisionId, workspaceId, conversationId: input.conversationId, revisionNumber: input.revisionNumber,
    parentRevisionId: input.parentRevisionId, producingRunId: input.producingRunId, transcriptId: input.transcriptId,
    diarizationVersionId: input.diarizationVersionId, authorKind: input.authorUserId ? "HUMAN" : "EXTRACTION",
    authorUserId: input.authorUserId, operationKey: input.operationKey, inputFingerprint: input.inputFingerprint,
    schemaVersion: output.versions.schema, taskProfileVersion: output.versions.task, promptVersion: output.versions.prompt,
    policyVersion: output.versions.policy, validationSummary: { findings: output.findings } as unknown as Prisma.InputJsonValue,
  } });
  const client = output.draft.client;
  await tx.proposalClientDraft.create({ data: {
    revisionId, workspaceId, stableItemId: "client", ...client,
    normalizedEmail: client.email && !validateProposalDraft(output.draft).some((f) => f.target === "client" && f.fieldKey === "email") ? client.email : null,
    normalizedPhone: client.phone && /^\+[1-9]\d{7,14}$/.test(client.phone) ? client.phone : null,
  } });
  const items = output.draft.requests.map((item, displayOrder) => ({
    id: randomUUID(), revisionId, workspaceId, stableItemId: item.stableItemId, displayOrder,
    title: item.title || null, description: item.description || null,
    serviceType: item.serviceType ? item.serviceType.toUpperCase() as "INSTALLATION" | "REPAIR" | "MAINTENANCE" | "INSPECTION" | "OTHER" : null,
    priority: item.priority ? item.priority.toUpperCase() as "LOW" | "NORMAL" | "HIGH" : null,
    preferredSchedule: item.preferredSchedule || null, serviceAddress: item.serviceAddress || null, nextSteps: item.nextSteps || null,
  }));
  await tx.proposalRequestItem.createMany({ data: items });
  const itemMap = new Map(items.map((item) => [item.stableItemId, item.id]));
  const fieldRows = output.fields.map((field) => ({ id: randomUUID(), revisionId, workspaceId,
    target: field.target === "client" ? "CLIENT" as const : "REQUEST" as const,
    requestItemId: field.itemId ? itemMap.get(field.itemId)! : null, fieldKey: field.fieldKey,
    observedValue: field.observedValue, normalizedValue: field.normalizedValue,
    provenance: field.provenance.toUpperCase() as "EXTRACTED" | "MANUAL" | "DEFAULT", confidence: field.confidence,
  }));
  await tx.proposalField.createMany({ data: fieldRows });
  const links = output.fields.flatMap((field, index) => field.evidenceIds.map((evidenceId) => {
    const id = evidenceMap.get(evidenceId);
    if (!id) throw new ProposalValidationError("EXTRACTION_INVALID_EVIDENCE");
    return { workspaceId, proposalFieldId: fieldRows[index]!.id, evidenceId: id };
  }));
  if (links.length) await tx.proposalFieldEvidence.createMany({ data: links });
  if (output.findings.length) await tx.proposalFinding.createMany({ data: output.findings.map((finding) => ({
    workspaceId, revisionId, code: finding.code, severity: finding.severity.toUpperCase() as "BLOCKING" | "WARNING" | "INFO",
    fieldId: finding.fieldKey ? fieldRows.find((field) => field.fieldKey === finding.fieldKey
      && field.requestItemId === (finding.itemId ? itemMap.get(finding.itemId) : null))?.id : null,
    resolvedAt: finding.resolution ? new Date() : null,
  })) });
  await tx.proposalRevision.update({ where: { id: revisionId }, data: { sealedAt: new Date() } });
}

/** Atomic delivery boundary: there is no separate callback that can charge without a proposal. */
export async function publishExtraction(processingRunId: string, extraction: ValidatedExtraction,
  lease: { attempt: number; leaseReference: string; expiresAt: Date }): Promise<string | null> {
  return serializable(async (tx) => {
    const run = await tx.processingRun.findUnique({ where: { id: processingRunId }, select: {
      id: true, workspaceId: true, conversationId: true, status: true,
      reservation: { select: { id: true, quantity: true, status: true } },
      workspace: { select: { lifecycle: true, owner: { select: { status: true, banned: true, role: true } } } },
      conversation: { select: { ...conversationSelect, currentRunId: true,
        originalTranscript: { select: { id: true, text: true, evidence: { select: { stableEvidenceId: true, startOffset: true, endOffset: true } } } },
        diarizationVersions: { select: { id: true }, orderBy: { version: "desc" }, take: 1 } } },
    } });
    if (!run || run.conversation.deletionState !== "ACTIVE" || run.conversation.currentRunId !== run.id
      || run.workspace.lifecycle !== "ACTIVE" || run.workspace.owner.status !== "active" || run.workspace.owner.banned
      || run.workspace.owner.role !== "trial_user") return null;
    const replay = await tx.proposalRevision.findFirst({ where: { operationKey: `extraction:${run.id}`, workspaceId: run.workspaceId }, select: { id: true } });
    if (replay && run.status === "SUCCEEDED" && run.reservation?.status === "CONSUMED") return replay.id;
    if (!["ACCEPTED", "RUNNING"].includes(run.status) || run.reservation?.status !== "ACTIVE"
      || run.conversation.completedOperationId || !["EXTRACTING", "VALIDATING"].includes(run.conversation.status)) return null;
    const checkpoint = await tx.processingCheckpoint.findFirst({ where: { runId: run.id, workspaceId: run.workspaceId,
      stage: "EXTRACTING", attempt: lease.attempt, leaseReference: lease.leaseReference, outcome: "PENDING" }, select: { id: true, updatedAt: true } });
    if (!checkpoint || lease.expiresAt.getTime() <= Date.now() || checkpoint.updatedAt.getTime() + 5 * 60 * 1000 <= Date.now()) return null;
    const transcript = run.conversation.originalTranscript;
    if (!transcript) throw new ProposalValidationError("TRANSCRIPT_REQUIRED");
    const output = validateExtraction(extraction, transcript.evidence.map((entry) => ({ id: entry.stableEvidenceId, text: transcript.text.slice(entry.startOffset, entry.endOffset) })));
    const revisionId = randomUUID();
    await persistRevision(tx, { id: revisionId, workspaceId: run.workspaceId, conversationId: run.conversationId,
      revisionNumber: run.conversation.currentProposalRevisionId ? await nextRevisionNumber(tx, run.conversation) : 1,
      parentRevisionId: run.conversation.currentProposalRevisionId, producingRunId: run.id, transcriptId: transcript.id,
      diarizationVersionId: run.conversation.diarizationVersions[0]?.id ?? null, authorUserId: null,
      operationKey: `extraction:${run.id}`, output });
    const reservation = await tx.creditReservation.updateMany({ where: { id: run.reservation.id, status: "ACTIVE", workspaceId: run.workspaceId },
      data: { status: "CONSUMED", settledAt: new Date(), settlementReason: "PROPOSAL_AVAILABLE" } });
    if (reservation.count !== 1) throw new ProposalValidationError("RESERVATION_CONFLICT");
    await tx.creditEntry.create({ data: { workspaceId: run.workspaceId, kind: "CONSUME", quantity: run.reservation.quantity,
      reservationId: run.reservation.id, processingRunId: run.id, reason: "PROPOSAL_AVAILABLE", operationKey: `processing-consume-entry:${run.id}` } });
    const changed = await tx.conversation.updateMany({ where: { id: run.conversationId, workspaceId: run.workspaceId,
      currentRunId: run.id, currentProposalRevisionId: run.conversation.currentProposalRevisionId, completedOperationId: null,
      deletionState: "ACTIVE", version: run.conversation.version },
      data: { status: "NEEDS_REVIEW", currentProposalRevisionId: run.conversation.currentProposalRevisionId ?? revisionId, version: { increment: 1 } } });
    if (changed.count !== 1) throw new ProposalValidationError("STALE_VERSION");
    await tx.processingRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", stage: "PUBLISHING", finishedAt: new Date(), terminalReason: null, retryable: false } });
    await tx.providerInvocation.updateMany({ where: { processingRunId: run.id, capability: "conversation_extraction" },
      data: { status: "SUCCEEDED", safeError: null, providerUpdatedAt: new Date() } });
    await tx.processingCheckpoint.updateMany({ where: { runId: run.id, stage: { in: ["EXTRACTING", "VALIDATING"] }, outcome: "PENDING" },
      data: { outcome: "SUCCEEDED", committedArtifactIds: { revisionId }, safeError: null } });
    await tx.processingCheckpoint.upsert({ where: { runId_stage_attempt: { runId: run.id, stage: "PUBLISHING", attempt: 1 } },
      create: { workspaceId: run.workspaceId, runId: run.id, stage: "PUBLISHING", attempt: 1, outcome: "SUCCEEDED", committedArtifactIds: { revisionId } },
      update: { outcome: "SUCCEEDED", committedArtifactIds: { revisionId }, safeError: null } });
    return revisionId;
  });
}

export async function saveProposalRevision(input: SaveProposalRevisionInput): Promise<ServiceResponse<ConversationReview>> {
  const parsed = saveProposalRevisionSchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  const values = parsed.data;
  const draft = normalizeProposalDraft(values.draft);
  if (hasSensitiveDraft(draft) || values.resolutions.some((resolution) => hasExcludedSensitiveValues({ reason: resolution.reason }))) return recordFailure("SENSITIVE_DATA_DETECTED");
  const fingerprint = createHash("sha256").update(JSON.stringify({ ...values, draft })).digest("hex");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    const data = await serializable(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      const conversation = await loadConversation(tx, values.conversationId, workspace.id);
      const replay = await tx.proposalRevision.findFirst({ where: { operationKey: `review:${workspace.id}:${values.operationId}`, workspaceId: workspace.id }, select: revisionSelect });
      if (replay) {
        if (replay.conversationId !== conversation.id || replay.inputFingerprint !== fingerprint) throw new ProposalValidationError("IDEMPOTENCY_CONFLICT");
        return reviewResult(tx, conversation, replay.id);
      }
      if (conversation.completedOperationId || !["NEEDS_REVIEW", "READY", "RECORD_PLAN_PENDING"].includes(conversation.status)) throw new ProposalValidationError("INVALID_STATUS_TRANSITION");
      if (conversation.version !== values.expectedVersion || conversation.currentProposalRevisionId !== values.baseRevisionId) throw new ProposalValidationError("STALE_VERSION");
      if (await getPendingReprocessingCandidate(tx, conversation)) throw new ProposalValidationError("REPROCESSING_CANDIDATE_PENDING");
      const parent = await tx.proposalRevision.findFirst({ where: { id: values.baseRevisionId, conversationId: conversation.id, workspaceId: workspace.id, sealedAt: { not: null } }, select: revisionSelect });
      if (!parent?.transcriptId) throw new ProposalValidationError("NOT_FOUND");
      const previous = revisionView(parent);
      const previousFields = new Map(previous.fields.map((field) => [fieldIdentity(field.target, field.itemId, field.fieldKey), field]));
      const fields = draftFields(draft).map((field): ProposalField => {
        const old = previousFields.get(fieldIdentity(field.target, field.itemId, field.fieldKey));
        if (old && (old.normalizedValue ?? "") === field.value) return old;
        return { target: field.target, itemId: field.itemId, fieldKey: field.fieldKey, observedValue: null,
          normalizedValue: field.value || null, provenance: "manual", evidenceIds: [], confidence: null };
      });
      const remainingIds = new Set(draft.requests.map((item) => item.stableItemId));
      const semantic = previous.findings.filter((finding) => isPersistentFinding(finding.code)
        && (finding.target !== "request" || remainingIds.has(finding.itemId ?? "")));
      const resolutions = new Map(values.resolutions.map((resolution) => [resolution.findingId, resolution.reason]));
      if (resolutions.size !== values.resolutions.length || values.resolutions.some((resolution) => !semantic.some((finding) => finding.id === resolution.findingId && isResolvableFinding(finding.code)))) throw new ProposalValidationError("VALIDATION_ERROR");
      const findings = [...validateProposalDraft(draft), ...semantic.map((finding) => {
        const relevantChanged = finding.target === "conversation" ? JSON.stringify(draft) !== JSON.stringify(previous.draft)
          : finding.target === "client" ? (finding.fieldKey ? draft.client[finding.fieldKey as typeof clientFieldKeys[number]] !== previous.draft.client[finding.fieldKey as typeof clientFieldKeys[number]] : JSON.stringify(draft.client) !== JSON.stringify(previous.draft.client))
          : JSON.stringify(draft.requests.find((item) => item.stableItemId === finding.itemId)) !== JSON.stringify(previous.draft.requests.find((item) => item.stableItemId === finding.itemId));
        return { ...finding, resolution: resolutions.get(finding.id) ?? (relevantChanged ? null : finding.resolution) };
      })];
      if (JSON.stringify(draft) === JSON.stringify(previous.draft) && JSON.stringify(findings) === JSON.stringify(previous.findings)) return reviewResult(tx, conversation);
      const revisionId = randomUUID();
      const revisionNumber = await nextRevisionNumber(tx, conversation);
      await persistRevision(tx, { id: revisionId, workspaceId: workspace.id, conversationId: conversation.id,
        revisionNumber, parentRevisionId: parent.id, producingRunId: parent.producingRunId,
        transcriptId: parent.transcriptId, diarizationVersionId: parent.diarizationVersionId, authorUserId: session.user.id,
        operationKey: `review:${workspace.id}:${values.operationId}`, inputFingerprint: fingerprint,
        output: { draft, fields, findings, versions: { schema: parent.schemaVersion, task: parent.taskProfileVersion, prompt: parent.promptVersion, policy: parent.policyVersion } } });
      const updated = await tx.conversation.updateMany({ where: { id: conversation.id, workspaceId: workspace.id,
        version: values.expectedVersion, currentProposalRevisionId: parent.id, deletionState: "ACTIVE" },
        data: { currentProposalRevisionId: revisionId, status: "NEEDS_REVIEW", version: { increment: 1 } } });
      if (updated.count !== 1) throw new ProposalValidationError("STALE_VERSION");
      await tx.proposalRevision.update({ where: { id: parent.id }, data: { status: "SUPERSEDED" } });
      await tx.recordPlan.updateMany({ where: { workspaceId: workspace.id, sourceConversationId: conversation.id, status: { in: ["PREPARED", "APPROVED"] } }, data: { status: "INVALIDATED", invalidatedAt: new Date() } });
      await tx.auditEvent.create({ data: { workspaceId: workspace.id, actorUserId: session.user.id, resourceType: "conversation",
        resourceId: conversation.id, action: "proposal.revision.saved", outcome: "SUCCEEDED", correlationId: conversation.correlationId,
        safeMetadata: { revisionId, revisionNumber } } });
      return reviewResult(tx, { ...conversation, version: conversation.version + 1, status: "NEEDS_REVIEW", currentProposalRevisionId: revisionId });
    });
    return { success: true, data };
  } catch (error) { return errorResponse(error); }
}

export async function markProposalReady(input: MarkProposalReadyInput): Promise<ServiceResponse<ConversationReview>> {
  const parsed = markProposalReadySchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  const values = parsed.data;
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    const data = await serializable(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      const conversation = await loadConversation(tx, values.conversationId, workspace.id);
      if (conversation.currentProposalRevisionId !== values.revisionId) throw new ProposalValidationError("STALE_VERSION");
      if (conversation.status === "READY") return reviewResult(tx, conversation);
      if (conversation.version !== values.expectedVersion) throw new ProposalValidationError("STALE_VERSION");
      if (conversation.status !== "NEEDS_REVIEW" || conversation.completedOperationId) throw new ProposalValidationError("INVALID_STATUS_TRANSITION");
      if (await getPendingReprocessingCandidate(tx, conversation)) throw new ProposalValidationError("REPROCESSING_CANDIDATE_PENDING");
      const current = await reviewResult(tx, conversation);
      const revision = current.revision;
      if (!revision || !canPrepareProposal([...validateProposalDraft(revision.draft), ...revision.findings]) || hasSensitiveDraft(revision.draft)) throw new ProposalValidationError("PROPOSAL_NOT_READY");
      const updated = await tx.conversation.updateMany({ where: { id: conversation.id, workspaceId: workspace.id,
        version: values.expectedVersion, currentProposalRevisionId: values.revisionId, deletionState: "ACTIVE" }, data: { status: "READY", version: { increment: 1 } } });
      if (updated.count !== 1) throw new ProposalValidationError("STALE_VERSION");
      await tx.proposalRevision.update({ where: { id: values.revisionId }, data: { status: "READY", readyAt: new Date(), readyByUserId: session.user.id } });
      await tx.auditEvent.create({ data: { workspaceId: workspace.id, actorUserId: session.user.id, resourceType: "conversation",
        resourceId: conversation.id, action: "proposal.ready", outcome: "SUCCEEDED", correlationId: conversation.correlationId, safeMetadata: { revisionId: values.revisionId } } });
      return reviewResult(tx, { ...conversation, version: conversation.version + 1, status: "READY" });
    });
    return { success: true, data };
  } catch (error) { return errorResponse(error); }
}

export async function resolveReprocessingCandidate(input: ResolveReprocessingCandidateInput): Promise<ServiceResponse<ConversationReview>> {
  const parsed = resolveReprocessingCandidateSchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  const values = parsed.data;
  const fingerprint = createHash("sha256").update(JSON.stringify(values)).digest("hex");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    const data = await serializable(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      const conversation = await loadConversation(tx, values.conversationId, workspace.id);
      const operationKey = `proposal-resolution:${workspace.id}:${values.operationId}`;
      const replay = await tx.auditEvent.findFirst({ where: { id: operationKey, workspaceId: workspace.id },
        select: { resourceId: true, safeMetadata: true } });
      if (replay) {
        if (replay.resourceId !== conversation.id || (replay.safeMetadata as { fingerprint?: string } | null)?.fingerprint !== fingerprint) {
          throw new ProposalValidationError("IDEMPOTENCY_CONFLICT");
        }
        return reviewResult(tx, conversation);
      }
      if (conversation.completedOperationId || conversation.status !== "NEEDS_REVIEW") throw new ProposalValidationError("INVALID_STATUS_TRANSITION");
      if (conversation.version !== values.expectedVersion || conversation.currentProposalRevisionId !== values.baseRevisionId) {
        throw new ProposalValidationError("STALE_VERSION");
      }
      const candidate = await getPendingReprocessingCandidate(tx, conversation);
      if (!candidate || candidate.id !== values.candidateRevisionId) throw new ProposalValidationError("STALE_VERSION");
      const parent = await tx.proposalRevision.findFirst({ where: { id: values.baseRevisionId, workspaceId: workspace.id,
        conversationId: conversation.id, sealedAt: { not: null } }, select: revisionSelect });
      if (!parent?.transcriptId || candidate.transcriptId !== parent.transcriptId) throw new ProposalValidationError("NOT_FOUND");
      const adopted = adoptReprocessingSelection(revisionView(parent), revisionView(candidate), values, randomUUID);
      if (hasSensitiveDraft(adopted.draft)) throw new ProposalValidationError("SENSITIVE_DATA_DETECTED");
      let revisionId = parent.id;
      if (!values.keepPrevious) {
        revisionId = randomUUID();
        await persistRevision(tx, { id: revisionId, workspaceId: workspace.id, conversationId: conversation.id,
          revisionNumber: await nextRevisionNumber(tx, conversation), parentRevisionId: parent.id,
          producingRunId: candidate.producingRunId, transcriptId: parent.transcriptId,
          diarizationVersionId: candidate.diarizationVersionId, authorUserId: session.user.id,
          operationKey, inputFingerprint: fingerprint,
          output: { ...adopted, versions: { schema: candidate.schemaVersion, task: candidate.taskProfileVersion,
            prompt: candidate.promptVersion, policy: candidate.policyVersion } } });
        await tx.proposalRevision.update({ where: { id: parent.id }, data: { status: "SUPERSEDED" } });
      }
      await tx.proposalRevision.update({ where: { id: candidate.id }, data: { status: values.keepPrevious ? "INVALIDATED" : "SUPERSEDED" } });
      const changed = await tx.conversation.updateMany({ where: { id: conversation.id, workspaceId: workspace.id,
        version: values.expectedVersion, currentProposalRevisionId: parent.id, completedOperationId: null, deletionState: "ACTIVE" },
        data: { currentProposalRevisionId: revisionId, status: "NEEDS_REVIEW", version: { increment: 1 } } });
      if (changed.count !== 1) throw new ProposalValidationError("STALE_VERSION");
      await tx.recordPlan.updateMany({ where: { workspaceId: workspace.id, sourceConversationId: conversation.id,
        status: { in: ["PREPARED", "APPROVED"] } }, data: { status: "INVALIDATED", invalidatedAt: new Date() } });
      await tx.auditEvent.create({ data: { id: operationKey, workspaceId: workspace.id, actorUserId: session.user.id,
        resourceType: "conversation", resourceId: conversation.id,
        action: values.keepPrevious ? "proposal.candidate.kept_previous" : "proposal.candidate.adopted", outcome: "SUCCEEDED",
        correlationId: conversation.correlationId, safeMetadata: { fingerprint, revisionId, candidateRevisionId: candidate.id } } });
      return reviewResult(tx, { ...conversation, currentProposalRevisionId: revisionId, version: conversation.version + 1 });
    });
    return { success: true, data };
  } catch (error) { return errorResponse(error); }
}
