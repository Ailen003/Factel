import { createHash, randomUUID } from "node:crypto";
import { FatalError, sleep } from "workflow";
import { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { extractConversation } from "@/lib/ai/conversation-extraction";
import { ExtractionError, extractionLeaseMs, extractionModel, extractionPrompt, extractionVersions, getExtractionProfile, type ExtractionLease } from "@/lib/ai/extraction-profile";
import { publishExtraction } from "@/modules/conversations/lib/services/proposal.services";
import { failConversationProcessingStep } from "./conversation-transcription.workflow";

const capability = "conversation_extraction";

async function transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(operation, { isolationLevel: "Serializable" }); }
    catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) continue;
      throw error;
    }
  }
}

/** The provider response is validated and committed inside this step, never stored in workflow outputs. */
export async function extractAndPublishConversationStep(processingRunId: string): Promise<"done" | "busy" | "retry" | "stopped"> {
  "use step";
  let lease: ExtractionLease | null = null;
  let maxAttempts = 1;
  let providerCompleted = false;
  try {
    const profile = getExtractionProfile();
    maxAttempts = profile.maxAttempts;
    const claim = await transaction(async (tx) => {
      const run = await tx.processingRun.findUnique({
        where: { id: processingRunId },
        select: {
          id: true, workspaceId: true, status: true,
          workspace: { select: { lifecycle: true, owner: { select: { status: true, banned: true, role: true } } } },
          reservation: { select: { status: true } },
          conversation: { select: { id: true, deletionState: true, currentRunId: true, completedOperationId: true,
            originalTranscript: { select: { language: true, text: true, evidence: { select: { stableEvidenceId: true, startOffset: true, endOffset: true }, orderBy: { startOffset: "asc" } } } },
          } },
          checkpoints: { where: { stage: "EXTRACTING" }, orderBy: { attempt: "desc" }, take: 1, select: { attempt: true, outcome: true, updatedAt: true, leaseReference: true } },
        },
      });
      if (run?.status === "SUCCEEDED") return { state: "done" } as const;
      if (!run || !["ACCEPTED", "RUNNING"].includes(run.status) || run.reservation?.status !== "ACTIVE"
        || run.conversation.deletionState !== "ACTIVE" || run.conversation.currentRunId !== run.id
        || run.conversation.completedOperationId) return { state: "stopped" } as const;
      if (run.workspace.lifecycle !== "ACTIVE" || run.workspace.owner.status !== "active"
        || run.workspace.owner.banned || run.workspace.owner.role !== "trial_user") throw new ExtractionError("EXTRACTION_AUTHORITY_REVOKED");
      const previous = run.checkpoints[0];
      if (previous?.outcome === "PENDING") {
        if (Date.now() - previous.updatedAt.getTime() >= extractionLeaseMs) throw new ExtractionError("EXTRACTION_SUBMISSION_UNCERTAIN");
        return { state: "busy" } as const;
      }
      const attempt = (previous?.attempt ?? 0) + 1;
      if (attempt > profile.maxAttempts) throw new ExtractionError("EXTRACTION_ATTEMPTS_EXHAUSTED");
      const transcript = run.conversation.originalTranscript;
      if (!transcript) throw new ExtractionError("TRANSCRIPT_NOT_AVAILABLE");
      const claimedLease = { attempt, leaseReference: randomUUID(), expiresAt: new Date(Date.now() + extractionLeaseMs) };
      await tx.processingCheckpoint.create({ data: { workspaceId: run.workspaceId, runId: run.id, stage: "EXTRACTING", attempt, leaseReference: claimedLease.leaseReference } });
      await tx.providerInvocation.upsert({
        where: { processingRunId_capability: { processingRunId, capability } },
        create: { workspaceId: run.workspaceId, processingRunId, capability, providerAlias: "groq", modelAlias: extractionModel,
          taskProfileVersion: extractionVersions.task, promptFingerprint: createHash("sha256").update(extractionPrompt).digest("hex"),
          schemaFingerprint: createHash("sha256").update(extractionVersions.schema).digest("hex"), correlationId: randomUUID(), providerUpdatedAt: new Date() },
        update: { status: "PENDING", safeError: null, providerUpdatedAt: new Date() },
      });
      await tx.processingRun.update({ where: { id: run.id }, data: { status: "RUNNING", stage: "EXTRACTING", taskProfileVersion: extractionVersions.task, policyVersion: extractionVersions.policy } });
      await tx.conversation.update({ where: { id: run.conversation.id }, data: { status: "EXTRACTING", version: { increment: 1 } } });
      return { state: "claimed", lease: claimedLease, input: { language: transcript.language, evidence: transcript.evidence.map((span) => ({ id: span.stableEvidenceId, text: transcript.text.slice(span.startOffset, span.endOffset) })) } } as const;
    });
    if (claim.state !== "claimed") return claim.state;
    lease = claim.lease;
    const result = await extractConversation(claim.input);
    providerCompleted = true;
    // Retry DB writes using the same in-memory result, never another provider invocation.
    const validated = await transaction(async (tx) => {
      if (Date.now() >= claim.lease.expiresAt.getTime()) return false;
      const checkpoint = await tx.processingCheckpoint.findFirst({ where: { runId: processingRunId, stage: "EXTRACTING", attempt: claim.lease.attempt, leaseReference: claim.lease.leaseReference, outcome: "PENDING" }, select: { id: true } });
      if (!checkpoint) return false;
      const updated = await tx.processingRun.updateMany({ where: { id: processingRunId, status: "RUNNING", reservation: { status: "ACTIVE" }, conversation: { deletionState: "ACTIVE", currentRunId: processingRunId, completedOperationId: null } }, data: { stage: "VALIDATING" } });
      if (updated.count !== 1) return false;
      await tx.conversation.updateMany({ where: { currentRunId: processingRunId, deletionState: "ACTIVE", status: "EXTRACTING" }, data: { status: "VALIDATING", version: { increment: 1 } } });
      await tx.providerInvocation.updateMany({ where: { processingRunId, capability }, data: { latencyMs: result.latencyMs, usage: result.usage, providerUpdatedAt: new Date() } });
      return true;
    });
    if (!validated) return "stopped";
    let revisionId: string | null = null;
    for (let attempt = 0; ; attempt++) {
      try { revisionId = await publishExtraction(processingRunId, result.extraction, claim.lease); break; }
      catch (error) {
        if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) continue;
        throw error;
      }
    }
    if (!revisionId) return "stopped";
    return "done";
  } catch (error) {
    const safe = error instanceof ExtractionError ? error : new ExtractionError(providerCompleted ? "EXTRACTION_PUBLICATION_FAILED" : "EXTRACTION_INTERNAL_ERROR");
    if (safe.retryable && lease !== null && lease.attempt < maxAttempts) {
      const activeLease = lease;
      const retried = await transaction(async (tx) => {
        if (Date.now() >= activeLease.expiresAt.getTime()) return false;
        const updated = await tx.processingCheckpoint.updateMany({ where: { runId: processingRunId, stage: "EXTRACTING", attempt: activeLease.attempt, leaseReference: activeLease.leaseReference, outcome: "PENDING", run: { status: "RUNNING", reservation: { status: "ACTIVE" }, conversation: { deletionState: "ACTIVE", currentRunId: processingRunId } } }, data: { outcome: "RETRYABLE_FAILURE", safeError: safe.code } });
        if (updated.count !== 1) return false;
        await tx.providerInvocation.updateMany({ where: { processingRunId, capability }, data: { status: "FAILED", safeError: safe.code, providerUpdatedAt: new Date() } });
        return true;
      });
      return retried ? "retry" : "stopped";
    }
    if (lease) await failConversationProcessingStep(processingRunId, safe.code, safe.retryable, lease);
    else if (safe.code === "EXTRACTION_SUBMISSION_UNCERTAIN") await failConversationProcessingStep(processingRunId, safe.code, safe.retryable, { expiredBefore: new Date(Date.now() - extractionLeaseMs) });
    else await failConversationProcessingStep(processingRunId, safe.code, safe.retryable);
    throw new FatalError(safe.code);
  }
}
extractAndPublishConversationStep.maxRetries = 0;

export async function conversationExtractionWorkflow(processingRunId: string): Promise<void> {
  "use workflow";
  for (let poll = 0; poll < 110; poll++) {
    const result = await extractAndPublishConversationStep(processingRunId);
    if (result === "done" || result === "stopped") return;
    await sleep("3s");
  }
  await failConversationProcessingStep(processingRunId, "EXTRACTION_SUBMISSION_UNCERTAIN", false);
}
