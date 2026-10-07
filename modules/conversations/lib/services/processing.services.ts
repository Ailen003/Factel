import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { resolveCurrentWorkspace } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/types";
import { ExtractionError, extractionLeaseMs, getExtractionProfile } from "@/lib/ai/extraction-profile";
import type { ServiceResponse } from "@/lib/api-responses";
import { assertRecordAccess } from "@/lib/records/record-policy";
import { dispatchConversationProcessingOutboxEvent } from "@/lib/workflow/conversation-processing.dispatcher";
import { failConversationProcessingStep } from "@/lib/workflow/conversation-transcription.workflow";
import {
  startConversationProcessingSchema,
  continueConversationExtractionSchema,
  type ContinueConversationExtractionInput,
  type ProcessingStartResult,
  type StartConversationProcessingInput,
} from "../types/conversation.types";
import { getWorkspaceCreditBalance, initializeWorkspaceCredits } from "./credit.services";
import { getPendingReprocessingCandidate } from "./proposal.services";

const dispatchBatchSize = 20;

class ProcessingServiceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ProcessingServiceError";
  }
}

function failure(code: string): ServiceResponse<never> {
  return { success: false, error: { code, message: code } };
}

function speechEnabled(): boolean {
  return process.env.CONVERSATION_SPEECH_ENABLED?.trim().toLowerCase() === "true";
}

function serviceError(error: unknown): ServiceResponse<never> {
  if (error instanceof AuthError || error instanceof ProcessingServiceError || error instanceof ExtractionError) return failure(error.code);
  console.error("Conversation processing operation failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return failure("INTERNAL_ERROR");
}

function retryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === "P2034" || error.code === "P2002");
}

async function existingStartResult(
  workspaceId: string,
  conversationId: string,
  scopedIdempotencyKey: string,
): Promise<ProcessingStartResult | null> {
  const existing = await prisma.processingRun.findFirst({
    where: {
      workspaceId,
      OR: [
        { idempotencyKey: scopedIdempotencyKey },
        { conversationId, status: { in: ["ACCEPTED", "RUNNING"] } },
      ],
    },
    select: {
      id: true,
      conversationId: true,
      conversation: { select: { version: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!existing) return null;
  if (existing.conversationId !== conversationId) throw new ProcessingServiceError("IDEMPOTENCY_CONFLICT");
  return {
    processingRunId: existing.id,
    conversationId: existing.conversationId,
    version: existing.conversation.version,
  };
}

export async function startConversationProcessing(
  input: StartConversationProcessingInput,
): Promise<ServiceResponse<ProcessingStartResult>> {
  return startProcessing(input, false);
}

export async function startConversationReprocessing(
  input: StartConversationProcessingInput,
): Promise<ServiceResponse<ProcessingStartResult>> {
  return startProcessing(input, true);
}

async function startProcessing(
  input: StartConversationProcessingInput,
  reprocessing: boolean,
): Promise<ServiceResponse<ProcessingStartResult>> {
  const parsed = startConversationProcessingSchema.safeParse(input);
  if (!parsed.success) return failure("VALIDATION_ERROR");
  try {
    getExtractionProfile();
    const { session, workspace } = await resolveCurrentWorkspace();
    const scopedIdempotencyKey = `${reprocessing ? "reprocessing:" : ""}${workspace.id}:${parsed.data.idempotencyKey}`;
    const replay = await existingStartResult(workspace.id, parsed.data.conversationId, scopedIdempotencyKey);
    if (replay) return { success: true, data: replay };

    let started: ProcessingStartResult | null = null;
    let outboxEventId: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          await assertRecordAccess(tx, session, workspace.id);
          const existing = await tx.processingRun.findFirst({
            where: {
              workspaceId: workspace.id,
              OR: [
                { idempotencyKey: scopedIdempotencyKey },
                { conversationId: parsed.data.conversationId, status: { in: ["ACCEPTED", "RUNNING"] } },
              ],
            },
            select: { id: true, conversationId: true, conversation: { select: { version: true } } },
            orderBy: { createdAt: "desc" },
          });
          if (existing) {
            if (existing.conversationId !== parsed.data.conversationId) {
              throw new ProcessingServiceError("IDEMPOTENCY_CONFLICT");
            }
            return {
              value: {
                processingRunId: existing.id,
                conversationId: existing.conversationId,
                version: existing.conversation.version,
              },
              outboxEventId: null,
            };
          }
          const conversation = await tx.conversation.findFirst({
            where: { id: parsed.data.conversationId, workspaceId: workspace.id },
            select: {
              id: true,
              version: true,
              status: true,
              deletionState: true,
              correlationId: true,
              currentProposalRevisionId: true,
              currentRunId: true,
              completedOperationId: true,
              originalTranscript: { select: { id: true } },
              audioArtifact: { select: { verificationState: true, deletionState: true } },
            },
          });
          if (!conversation || conversation.deletionState !== "ACTIVE") throw new ProcessingServiceError("NOT_FOUND");
          if (conversation.completedOperationId || conversation.status === "COMPLETED") throw new ProcessingServiceError("INVALID_STATUS_TRANSITION");
          if (reprocessing) {
            if (!conversation.currentProposalRevisionId || !conversation.originalTranscript
              || !["NEEDS_REVIEW", "READY", "RECORD_PLAN_PENDING"].includes(conversation.status)) {
              throw new ProcessingServiceError("INVALID_STATUS_TRANSITION");
            }
            if (await getPendingReprocessingCandidate(tx, { ...conversation, workspaceId: workspace.id })) {
              throw new ProcessingServiceError("REPROCESSING_CANDIDATE_PENDING");
            }
          } else if (conversation.currentProposalRevisionId) throw new ProcessingServiceError("INVALID_STATUS_TRANSITION");
          if (!conversation.originalTranscript && !speechEnabled()) throw new ProcessingServiceError("SPEECH_DISABLED");
          if (conversation.version !== parsed.data.expectedVersion) throw new ProcessingServiceError("STALE_VERSION");
          if (!reprocessing && conversation.status !== "AUDIO_READY" && conversation.status !== "FAILED") {
            throw new ProcessingServiceError("INVALID_STATUS_TRANSITION");
          }
          if (
            conversation.audioArtifact?.verificationState !== "VERIFIED"
            || conversation.audioArtifact.deletionState !== "ACTIVE"
          ) throw new ProcessingServiceError("AUDIO_NOT_VERIFIED");

          await initializeWorkspaceCredits(tx, workspace.id);
          const balance = await getWorkspaceCreditBalance(tx, workspace.id);
          if (balance.available < 1) throw new ProcessingServiceError("INSUFFICIENT_CREDITS");

          if (reprocessing) {
            await tx.proposalRevision.update({ where: { id: conversation.currentProposalRevisionId! },
              data: { status: "CANDIDATE", readyAt: null, readyByUserId: null } });
            await tx.recordPlan.updateMany({ where: { workspaceId: workspace.id, sourceConversationId: conversation.id,
              status: { in: ["PREPARED", "APPROVED"] } }, data: { status: "INVALIDATED", invalidatedAt: new Date() } });
          }

          const processingRunId = randomUUID();
          const reservationId = randomUUID();
          const eventId = randomUUID();
          const correlationId = randomUUID();
          const nextVersion = conversation.version + 1;
          const previousRun = await tx.processingRun.findFirst({
            where: { workspaceId: workspace.id, conversationId: conversation.id },
            select: { id: true },
            orderBy: { createdAt: "desc" },
          });
          await tx.processingRun.create({
            data: {
              id: processingRunId,
              workspaceId: workspace.id,
              conversationId: conversation.id,
              idempotencyKey: scopedIdempotencyKey,
              previousRunId: previousRun?.id,
              correlationId,
            },
          });
          await tx.creditReservation.create({
            data: {
              id: reservationId,
              workspaceId: workspace.id,
              processingRunId,
              quantity: 1,
              operationKey: `processing-reservation:${processingRunId}`,
            },
          });
          await tx.creditEntry.create({
            data: {
              workspaceId: workspace.id,
              kind: "RESERVE",
              quantity: 1,
              reservationId,
              processingRunId,
              actorUserId: session.user.id,
              reason: "CONVERSATION_PROCESSING",
              operationKey: `processing-reserve-entry:${processingRunId}`,
            },
          });
          await tx.processingCheckpoint.create({
            data: { workspaceId: workspace.id, runId: processingRunId, stage: "QUEUED", attempt: 1 },
          });
          await tx.outboxEvent.create({
            data: {
              id: eventId,
              workspaceId: workspace.id,
              eventType: conversation.originalTranscript ? "conversation.extraction.requested" : "conversation.processing.requested",
              aggregateType: "processing_run",
              aggregateId: processingRunId,
              idempotencyKey: `conversation-processing-start:${processingRunId}`,
              correlationId,
            },
          });
          const updated = await tx.conversation.updateMany({
            where: {
              id: conversation.id,
              workspaceId: workspace.id,
              version: conversation.version,
              deletionState: "ACTIVE",
            },
            data: { status: conversation.originalTranscript ? "EXTRACTING" : "QUEUED", currentRunId: processingRunId, version: { increment: 1 } },
          });
          if (updated.count !== 1) throw new ProcessingServiceError("STALE_VERSION");
          if (reprocessing) await tx.auditEvent.create({ data: { workspaceId: workspace.id, actorUserId: session.user.id,
            resourceType: "conversation", resourceId: conversation.id, action: "proposal.reprocessing.started", outcome: "SUCCEEDED",
            correlationId, safeMetadata: { processingRunId, baseRevisionId: conversation.currentProposalRevisionId } } });
          return {
            value: { processingRunId, conversationId: conversation.id, version: nextVersion },
            outboxEventId: eventId,
          };
        }, { isolationLevel: "Serializable" });
        started = result.value;
        outboxEventId = result.outboxEventId;
        break;
      } catch (error) {
        if (retryableTransactionError(error) && attempt < 2) continue;
        if (retryableTransactionError(error)) {
          const replayAfterConflict = await existingStartResult(
            workspace.id,
            parsed.data.conversationId,
            scopedIdempotencyKey,
          );
          if (replayAfterConflict) return { success: true, data: replayAfterConflict };
        }
        throw error;
      }
    }
    if (!started) return failure("INTERNAL_ERROR");
    if (outboxEventId) {
      try {
        await dispatchConversationProcessingOutboxEvent(outboxEventId);
      } catch (error) {
        console.error("Conversation processing dispatch deferred", {
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }
    return { success: true, data: started };
  } catch (error) {
    return serviceError(error);
  }
}

export interface ProcessingOutboxReconciliationResult {
  delivered: number;
  deferred: number;
}

export async function continueConversationExtraction(input: ContinueConversationExtractionInput): Promise<ServiceResponse<ProcessingStartResult>> {
  const parsed = continueConversationExtractionSchema.safeParse(input);
  if (!parsed.success) return failure("VALIDATION_ERROR");
  try {
    getExtractionProfile();
    const { session, workspace } = await resolveCurrentWorkspace();
    let result: { value: ProcessingStartResult; eventId: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await prisma.$transaction(async (tx) => {
          await assertRecordAccess(tx, session, workspace.id);
          const conversation = await tx.conversation.findFirst({
            where: { id: parsed.data.conversationId, workspaceId: workspace.id, deletionState: "ACTIVE" },
            select: { id: true, status: true, version: true, currentProposalRevisionId: true,
              originalTranscript: { select: { id: true } },
              currentRun: { select: { id: true, status: true, correlationId: true, reservation: { select: { status: true } } } },
            },
          });
          if (!conversation) throw new ProcessingServiceError("NOT_FOUND");
          const run = conversation.currentRun;
          if (!run || !["ACCEPTED", "RUNNING"].includes(run.status) || run.reservation?.status !== "ACTIVE"
            || !conversation.originalTranscript || conversation.currentProposalRevisionId) throw new ProcessingServiceError("INVALID_STATUS_TRANSITION");
          const eventKey = `conversation-extraction-continue:${run.id}`;
          const replay = await tx.outboxEvent.findUnique({ where: { idempotencyKey: eventKey }, select: { id: true } });
          const value = { processingRunId: run.id, conversationId: conversation.id, version: conversation.version };
          if (replay) return { value, eventId: replay.id };
          if (conversation.version !== parsed.data.expectedVersion) throw new ProcessingServiceError("STALE_VERSION");
          if (conversation.status !== "TRANSCRIBED") throw new ProcessingServiceError("INVALID_STATUS_TRANSITION");
          const event = await tx.outboxEvent.create({ data: {
            workspaceId: workspace.id, eventType: "conversation.extraction.requested", aggregateType: "processing_run",
            aggregateId: run.id, idempotencyKey: eventKey, correlationId: run.correlationId,
          }, select: { id: true } });
          const updated = await tx.conversation.updateMany({
            where: { id: conversation.id, workspaceId: workspace.id, version: conversation.version, deletionState: "ACTIVE", status: "TRANSCRIBED" },
            data: { status: "EXTRACTING", version: { increment: 1 } },
          });
          if (updated.count !== 1) throw new ProcessingServiceError("STALE_VERSION");
          return { value: { ...value, version: conversation.version + 1 }, eventId: event.id };
        }, { isolationLevel: "Serializable" });
        break;
      } catch (error) {
        if (attempt < 2 && retryableTransactionError(error)) continue;
        throw error;
      }
    }
    if (!result) return failure("INTERNAL_ERROR");
    try { await dispatchConversationProcessingOutboxEvent(result.eventId); }
    catch { /* The durable outbox scheduler retries delivery. */ }
    return { success: true, data: result.value };
  } catch (error) { return serviceError(error); }
}

export async function reconcileConversationProcessingOutbox(): Promise<ProcessingOutboxReconciliationResult> {
  const now = new Date();
  // A crashed worker may have paid the provider without receiving a response. Never
  // retry that uncertain call automatically; settle the reservation for explicit retry.
  const abandoned = await prisma.processingRun.findMany({
    where: { status: "RUNNING", stage: { in: ["EXTRACTING", "VALIDATING"] },
      conversation: { deletionState: "ACTIVE" },
      checkpoints: { some: { stage: "EXTRACTING", outcome: "PENDING", updatedAt: { lt: new Date(now.getTime() - extractionLeaseMs) } } },
    }, select: { id: true }, take: dispatchBatchSize,
  });
  for (const run of abandoned) {
    await failConversationProcessingStep(run.id, "EXTRACTION_SUBMISSION_UNCERTAIN", false, { expiredBefore: new Date(now.getTime() - extractionLeaseMs) });
  }
  const events = await prisma.outboxEvent.findMany({
    where: {
      eventType: { in: ["conversation.processing.requested", "conversation.extraction.requested"] },
      availableAt: { lte: now },
      OR: [
        { status: { in: ["PENDING", "FAILED"] } },
        { status: "PROCESSING", deliveredAt: null },
      ],
    },
    select: { id: true },
    orderBy: [{ availableAt: "asc" }, { id: "asc" }],
    take: dispatchBatchSize,
  });
  let delivered = 0;
  let deferred = 0;
  for (const event of events) {
    try {
      const result = await dispatchConversationProcessingOutboxEvent(event.id);
      if (result) delivered++;
    } catch {
      deferred++;
    }
  }
  return { delivered, deferred };
}
