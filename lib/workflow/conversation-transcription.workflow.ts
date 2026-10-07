import { randomUUID } from "node:crypto";
import { FatalError, RetryableError, sleep } from "workflow";
import { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { createSignedDownloadUrl } from "@/lib/storage/storage.service";
import { createProductionSpeechProvider } from "@/lib/speech/assemblyai.provider";
import { SpeechProviderError } from "@/lib/speech/speech-provider";
import { normalizeCompletedSpeechJob } from "@/lib/speech/transcript-normalization";
import { extractAndPublishConversationStep } from "./conversation-extraction.workflow";

type SubmissionClaim =
  | { state: "claimed" }
  | { state: "in_progress" }
  | { state: "submitted"; jobId: string }
  | { state: "stopped" };

function terminalCode(error: unknown): { code: string; retryable: boolean } {
  if (error instanceof SpeechProviderError) return { code: error.code, retryable: error.retryable };
  return { code: "SPEECH_PROVIDER_UNAVAILABLE", retryable: true };
}

export async function failConversationProcessingStep(
  processingRunId: string,
  code: string,
  retryable: boolean,
  extractionAuthority?: { attempt: number; leaseReference: string } | { expiredBefore: Date },
): Promise<void> {
  "use step";
  await prisma.$transaction(async (tx) => {
    const run = await tx.processingRun.findUnique({
      where: { id: processingRunId },
      select: {
        id: true,
        workspaceId: true,
        conversationId: true,
        status: true,
        stage: true,
        conversation: { select: { currentProposalRevisionId: true } },
        reservation: { select: { id: true, status: true, quantity: true } },
      },
    });
    if (!run || run.status === "SUCCEEDED" || run.status === "CANCELLED" || run.status === "FAILED") return;
    if (extractionAuthority) {
      const checkpoint = await tx.processingCheckpoint.findFirst({
        where: { runId: run.id, stage: "EXTRACTING", outcome: "PENDING",
          ...("expiredBefore" in extractionAuthority
            ? { updatedAt: { lt: extractionAuthority.expiredBefore } }
            : { attempt: extractionAuthority.attempt, leaseReference: extractionAuthority.leaseReference }),
        },
        select: { id: true },
      });
      if (!checkpoint) return;
    }
    if (run.reservation?.status === "ACTIVE") {
      const restored = await tx.creditReservation.updateMany({
        where: { id: run.reservation.id, workspaceId: run.workspaceId, status: "ACTIVE" },
        data: { status: "RESTORED", settledAt: new Date(), settlementReason: code },
      });
      if (restored.count === 1) {
        await tx.creditEntry.create({
          data: {
            workspaceId: run.workspaceId,
            kind: "RESTORE",
            quantity: run.reservation.quantity,
            reservationId: run.reservation.id,
            processingRunId: run.id,
            reason: code,
            operationKey: `processing-restore-entry:${run.id}`,
          },
        });
      }
    }
    await tx.processingRun.updateMany({
      where: { id: run.id, status: { in: ["ACCEPTED", "RUNNING", "FAILED"] } },
      data: { status: "FAILED", terminalReason: code, retryable, finishedAt: new Date() },
    });
    await tx.processingCheckpoint.upsert({
      where: { runId_stage_attempt: { runId: run.id, stage: run.stage, attempt: 1 } },
      create: {
        workspaceId: run.workspaceId,
        runId: run.id,
        stage: run.stage,
        attempt: 1,
        outcome: "TERMINAL_FAILURE",
        safeError: code,
      },
      update: { outcome: "TERMINAL_FAILURE", safeError: code },
    });
    await tx.processingCheckpoint.updateMany({
      where: { runId: run.id, outcome: "PENDING" },
      data: { outcome: "TERMINAL_FAILURE", safeError: code },
    });
    await tx.providerInvocation.updateMany({
      where: { processingRunId: run.id, capability: "conversation_extraction", status: "PENDING" },
      data: { status: "FAILED", safeError: code, providerUpdatedAt: new Date() },
    });
    await tx.conversation.updateMany({
      where: {
        id: run.conversationId,
        workspaceId: run.workspaceId,
        currentRunId: run.id,
        deletionState: "ACTIVE",
        completedOperationId: null,
      },
      data: { status: run.conversation?.currentProposalRevisionId ? "NEEDS_REVIEW" : "FAILED", version: { increment: 1 } },
    });
  }, { isolationLevel: "Serializable" });
}

export async function claimTranscriptionSubmissionStep(processingRunId: string): Promise<SubmissionClaim> {
  "use step";
  return prisma.$transaction(async (tx) => {
    const run = await tx.processingRun.findUnique({
      where: { id: processingRunId },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        conversation: {
          select: {
            deletionState: true,
            status: true,
            audioArtifact: { select: { verificationState: true, deletionState: true } },
          },
        },
        providerInvocations: {
          where: { capability: "conversation_transcription" },
          select: { id: true, providerJobId: true, providerUpdatedAt: true, status: true },
          take: 1,
        },
      },
    });
    if (
      !run || !["ACCEPTED", "RUNNING"].includes(run.status)
      || run.conversation.deletionState !== "ACTIVE"
      || run.conversation.audioArtifact?.verificationState !== "VERIFIED"
      || run.conversation.audioArtifact.deletionState !== "ACTIVE"
    ) return { state: "stopped" } as const;
    const existing = run.providerInvocations[0];
    if (existing?.providerJobId) return { state: "submitted", jobId: existing.providerJobId } as const;
    if (existing?.status === "FAILED") return { state: "stopped" } as const;
    if (existing?.providerUpdatedAt) return { state: "in_progress" } as const;
    if (existing) {
      const claimed = await tx.providerInvocation.updateMany({
        where: { id: existing.id, providerJobId: null, providerUpdatedAt: null, status: "PENDING" },
        data: { providerUpdatedAt: new Date() },
      });
      return claimed.count === 1 ? { state: "claimed" } as const : { state: "in_progress" } as const;
    }
    try {
      await tx.providerInvocation.create({
        data: {
          workspaceId: run.workspaceId,
          processingRunId: run.id,
          capability: "conversation_transcription",
          providerAlias: "assemblyai",
          modelAlias: "universal-3-5-pro|universal-2",
          status: "PENDING",
          providerUpdatedAt: new Date(),
          correlationId: randomUUID(),
        },
      });
      return { state: "claimed" } as const;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { state: "in_progress" } as const;
      }
      throw error;
    }
  }, { isolationLevel: "Serializable" });
}

export async function getSubmissionStateStep(processingRunId: string): Promise<SubmissionClaim> {
  "use step";
  const run = await prisma.processingRun.findUnique({
    where: { id: processingRunId },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      conversation: { select: { deletionState: true, currentRunId: true } },
      providerInvocations: {
        where: { capability: "conversation_transcription" },
        select: { providerJobId: true, status: true },
        take: 1,
      },
    },
  });
  const invocation = run?.providerInvocations[0];
  if (
    !run || !["ACCEPTED", "RUNNING"].includes(run.status)
    || run.conversation.deletionState !== "ACTIVE"
    || run.conversation.currentRunId !== run.id
  ) return { state: "stopped" };
  if (invocation?.providerJobId) return { state: "submitted", jobId: invocation.providerJobId };
  if (!invocation || invocation.status === "FAILED" || invocation.status === "CANCELLED") return { state: "stopped" };
  return { state: "in_progress" };
}

export async function submitTranscriptionStep(processingRunId: string): Promise<string> {
  "use step";
  let providerJobId: string | null = null;
  let provider: ReturnType<typeof createProductionSpeechProvider> | null = null;
  try {
    const run = await prisma.processingRun.findUnique({
      where: { id: processingRunId },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        conversationId: true,
        conversation: {
          select: {
            locale: true,
            deletionState: true,
            audioArtifact: { select: { storageKey: true, verificationState: true, deletionState: true } },
          },
        },
      },
    });
    if (
      !run || !["ACCEPTED", "RUNNING"].includes(run.status)
      || run.conversation.deletionState !== "ACTIVE"
      || run.conversation.audioArtifact?.verificationState !== "VERIFIED"
      || run.conversation.audioArtifact.deletionState !== "ACTIVE"
    ) throw new SpeechProviderError("PROCESSING_AUTHORITY_REVOKED", false);
    const audioUrl = await createSignedDownloadUrl(run.conversation.audioArtifact.storageKey, 15 * 60);
    provider = createProductionSpeechProvider();
    providerJobId = (await provider.submit({ audioUrl, language: run.conversation.locale })).jobId;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const stored = await prisma.$transaction(async (tx) => {
          const current = await tx.processingRun.findUnique({
            where: { id: processingRunId },
            select: {
              workspaceId: true,
              status: true,
              conversation: { select: { deletionState: true } },
            },
          });
          if (!current || !["ACCEPTED", "RUNNING"].includes(current.status) || current.conversation.deletionState !== "ACTIVE") {
            if (current) {
              await tx.cleanupTask.upsert({
                where: {
                  resourceType_resourceId_deletionIntent: {
                    resourceType: "assemblyai_transcript",
                    resourceId: processingRunId,
                    deletionIntent: "late-submission",
                  },
                },
                create: {
                  workspaceId: current.workspaceId,
                  resourceType: "assemblyai_transcript",
                  resourceId: processingRunId,
                  providerReference: providerJobId!,
                  deletionIntent: "late-submission",
                  correlationId: randomUUID(),
                },
                update: { providerReference: providerJobId! },
              });
            }
            return false;
          }
          await tx.providerInvocation.update({
            where: { processingRunId_capability: { processingRunId, capability: "conversation_transcription" } },
            data: { providerJobId, providerUpdatedAt: new Date() },
          });
          await tx.processingRun.update({
            where: { id: processingRunId },
            data: { status: "RUNNING", stage: "TRANSCRIBING", startedAt: new Date() },
          });
          await tx.conversation.updateMany({
            where: { currentRunId: processingRunId, deletionState: "ACTIVE" },
            data: { status: "TRANSCRIBING", version: { increment: 1 } },
          });
          await tx.processingCheckpoint.upsert({
            where: { runId_stage_attempt: { runId: processingRunId, stage: "TRANSCRIBING", attempt: 1 } },
            create: { workspaceId: current.workspaceId, runId: processingRunId, stage: "TRANSCRIBING", attempt: 1 },
            update: { outcome: "PENDING", safeError: null },
          });
          return true;
        }, { isolationLevel: "Serializable" });
        if (!stored) {
          await provider.delete(providerJobId);
          throw new SpeechProviderError("PROCESSING_AUTHORITY_REVOKED", false);
        }
        return providerJobId;
      } catch (error) {
        if (attempt < 2 && !(error instanceof SpeechProviderError)) continue;
        throw error;
      }
    }
    throw new SpeechProviderError("SPEECH_PROVIDER_INVALID_RESPONSE", false);
  } catch (error) {
    const terminal = terminalCode(error);
    if (providerJobId) {
      let cleanupScheduled = false;
      try {
        const run = await prisma.processingRun.findUnique({
          where: { id: processingRunId },
          select: { workspaceId: true },
        });
        await prisma.cleanupTask.upsert({
          where: {
            resourceType_resourceId_deletionIntent: {
              resourceType: "assemblyai_transcript",
              resourceId: processingRunId,
              deletionIntent: "orphaned-submission",
            },
          },
          create: {
            workspaceId: run?.workspaceId,
            resourceType: "assemblyai_transcript",
            resourceId: processingRunId,
            providerReference: providerJobId,
            deletionIntent: "orphaned-submission",
            correlationId: randomUUID(),
          },
          update: { providerReference: providerJobId },
        });
        cleanupScheduled = true;
      } catch {
        // If persistence is unavailable, best-effort deletion avoids losing the only job reference.
      }
      if (!cleanupScheduled && provider) {
        try { await provider.delete(providerJobId); } catch { /* terminal bookkeeping follows */ }
      }
    }
    try {
      await failConversationProcessingStep(processingRunId, terminal.code, terminal.retryable);
      await prisma.providerInvocation.updateMany({
        where: { processingRunId, capability: "conversation_transcription", providerJobId: null },
        data: { status: "FAILED", safeError: terminal.code, providerUpdatedAt: new Date() },
      });
    } catch {
      // The workflow must never retry submission after provider creation may have occurred.
    }
    throw new FatalError(terminal.code);
  }
}

submitTranscriptionStep.maxRetries = 0;

export async function persistCompletedTranscriptStep(
  processingRunId: string,
  providerJobId: string,
): Promise<"pending" | "completed" | "stopped"> {
  "use step";
  const authority = await prisma.processingRun.findUnique({
    where: { id: processingRunId },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      conversation: { select: { deletionState: true, currentRunId: true, status: true } },
      transcript: { select: { id: true } },
    },
  });
  if (
    !authority || !["ACCEPTED", "RUNNING"].includes(authority.status)
    || authority.conversation.deletionState !== "ACTIVE"
    || authority.conversation.currentRunId !== authority.id
  ) {
    await prisma.cleanupTask.upsert({
      where: {
        resourceType_resourceId_deletionIntent: {
          resourceType: "assemblyai_transcript",
          resourceId: processingRunId,
          deletionIntent: "revoked-before-poll",
        },
      },
      create: {
        workspaceId: authority?.workspaceId,
        resourceType: "assemblyai_transcript",
        resourceId: processingRunId,
        providerReference: providerJobId,
        deletionIntent: "revoked-before-poll",
        correlationId: randomUUID(),
      },
      update: { providerReference: providerJobId },
    });
    return "stopped";
  }
  if (authority.transcript && authority.conversation.status === "TRANSCRIBED") {
    return "completed";
  }
  const provider = createProductionSpeechProvider();
  let job;
  try {
    job = await provider.get(providerJobId);
  } catch (error) {
    if (error instanceof SpeechProviderError && !error.retryable) {
      await failConversationProcessingStep(processingRunId, error.code, false);
      throw new FatalError(error.code);
    }
    throw new RetryableError("SPEECH_PROVIDER_TEMPORARY", { retryAfter: "5s" });
  }
  if (job.status === "queued" || job.status === "processing") {
    await prisma.providerInvocation.updateMany({
      where: { processingRunId, capability: "conversation_transcription", providerJobId },
      data: { providerUpdatedAt: new Date() },
    });
    return "pending";
  }
  if (job.status === "error") {
    await failConversationProcessingStep(processingRunId, job.errorCode, false);
    await prisma.providerInvocation.updateMany({
      where: { processingRunId, capability: "conversation_transcription", providerJobId },
      data: { status: "FAILED", safeError: job.errorCode, providerUpdatedAt: new Date() },
    });
    throw new FatalError(job.errorCode);
  }
  const normalized = normalizeCompletedSpeechJob(job);
  const persisted = await prisma.$transaction(async (tx) => {
    const run = await tx.processingRun.findUnique({
      where: { id: processingRunId },
      select: {
        id: true,
        workspaceId: true,
        conversationId: true,
        status: true,
        conversation: { select: { deletionState: true, currentRunId: true, status: true } },
        transcript: { select: { id: true, contentFingerprint: true } },
      },
    });
    if (
      !run || !["ACCEPTED", "RUNNING"].includes(run.status)
      || run.conversation.deletionState !== "ACTIVE"
      || run.conversation.currentRunId !== run.id
    ) {
      await tx.cleanupTask.upsert({
        where: {
          resourceType_resourceId_deletionIntent: {
            resourceType: "assemblyai_transcript",
            resourceId: processingRunId,
            deletionIntent: "late-result",
          },
        },
        create: {
          workspaceId: run?.workspaceId,
          resourceType: "assemblyai_transcript",
          resourceId: processingRunId,
          providerReference: providerJobId,
          deletionIntent: "late-result",
          correlationId: randomUUID(),
        },
        update: { providerReference: providerJobId },
      });
      return false;
    }
    if (run.transcript && run.transcript.contentFingerprint !== normalized.fingerprint) {
      throw new FatalError("TRANSCRIPT_CONFLICT");
    }
    if (run.transcript && run.conversation.status === "TRANSCRIBED") return true;
    let transcriptId = run.transcript?.id;
    if (!transcriptId) {
      transcriptId = randomUUID();
      const evidenceRows = normalized.segments.map((segment) => ({
        id: randomUUID(),
        workspaceId: run.workspaceId,
        transcriptId: transcriptId!,
        stableEvidenceId: segment.id,
        startOffset: segment.startOffset,
        endOffset: segment.endOffset,
        startMs: segment.startMs,
        endMs: segment.endMs,
      }));
      await tx.originalTranscript.create({
        data: {
          id: transcriptId,
          workspaceId: run.workspaceId,
          conversationId: run.conversationId,
          processingRunId: run.id,
          text: normalized.text,
          language: normalized.language,
          finalizedAt: new Date(normalized.completedAt),
          contentFingerprint: normalized.fingerprint,
        },
      });
      if (evidenceRows.length) await tx.transcriptEvidence.createMany({ data: evidenceRows });
      const diarizationId = randomUUID();
      await tx.diarizationVersion.create({
        data: {
          id: diarizationId,
          workspaceId: run.workspaceId,
          conversationId: run.conversationId,
          processingRunId: run.id,
          version: 1,
          status: normalized.diarizationStatus,
          warnings: normalized.warningCode ? { code: normalized.warningCode } : undefined,
        },
      });
      const speakerRows = normalized.segments.flatMap((segment, index) => {
        if (!segment.speakerId || segment.startMs === null || segment.endMs === null) return [];
        return [{
          id: randomUUID(),
          workspaceId: run.workspaceId,
          diarizationVersionId: diarizationId,
          evidenceId: evidenceRows[index]!.id,
          startMs: segment.startMs,
          endMs: segment.endMs,
          speakerLabel: segment.speakerId,
          confidence: segment.confidence,
        }];
      });
      if (speakerRows.length) await tx.speakerSegment.createMany({ data: speakerRows });
    }
    await tx.providerInvocation.update({
      where: { processingRunId_capability: { processingRunId, capability: "conversation_transcription" } },
      data: { status: "SUCCEEDED", safeError: null, providerUpdatedAt: new Date() },
    });
    await tx.processingCheckpoint.updateMany({
      where: { runId: run.id, stage: "TRANSCRIBING", outcome: "PENDING" },
      data: { outcome: "SUCCEEDED", committedArtifactIds: { transcriptId } },
    });
    await tx.processingCheckpoint.upsert({
      where: { runId_stage_attempt: { runId: run.id, stage: "DIARIZING", attempt: 1 } },
      create: {
        workspaceId: run.workspaceId,
        runId: run.id,
        stage: "DIARIZING",
        attempt: 1,
        outcome: "SUCCEEDED",
        committedArtifactIds: { transcriptId },
      },
      update: { outcome: "SUCCEEDED", safeError: null, committedArtifactIds: { transcriptId } },
    });
    await tx.processingRun.update({
      where: { id: run.id },
      data: { status: "RUNNING", stage: "EXTRACTING", terminalReason: null, retryable: false },
    });
    await tx.conversation.updateMany({
      where: { id: run.conversationId, workspaceId: run.workspaceId, currentRunId: run.id, deletionState: "ACTIVE" },
      data: { status: "TRANSCRIBED", version: { increment: 1 } },
    });
    return true;
  }, { isolationLevel: "Serializable" });
  if (!persisted) {
    try { await provider.delete(providerJobId); } catch { /* cleanup task remains authoritative */ }
    return "stopped";
  }
  return "completed";
}

export async function conversationTranscriptionWorkflow(processingRunId: string): Promise<void> {
  "use workflow";
  let submission = await claimTranscriptionSubmissionStep(processingRunId);
  if (submission.state === "stopped") return;
  if (submission.state === "claimed") {
    submission = { state: "submitted", jobId: await submitTranscriptionStep(processingRunId) };
  }
  for (let attempt = 0; submission.state === "in_progress" && attempt < 40; attempt++) {
    await sleep("3s");
    submission = await getSubmissionStateStep(processingRunId);
  }
  if (submission.state === "in_progress") {
    await failConversationProcessingStep(processingRunId, "SUBMISSION_UNCERTAIN", false);
    throw new FatalError("SUBMISSION_UNCERTAIN");
  }
  if (submission.state !== "submitted") return;
  for (let poll = 0; poll < 200; poll++) {
    let result: "pending" | "completed" | "stopped";
    try {
      result = await persistCompletedTranscriptStep(processingRunId, submission.jobId);
    } catch {
      await failConversationProcessingStep(processingRunId, "TRANSCRIPTION_POLL_FAILED", true);
      throw new FatalError("TRANSCRIPTION_POLL_FAILED");
    }
    if (result === "stopped") return;
    if (result === "completed") {
      for (let attempt = 0; attempt < 110; attempt++) {
        const extraction = await extractAndPublishConversationStep(processingRunId);
        if (extraction === "done" || extraction === "stopped") return;
        await sleep("3s");
      }
      await failConversationProcessingStep(processingRunId, "EXTRACTION_SUBMISSION_UNCERTAIN", false);
      return;
    }
    await sleep("3s");
  }
  await failConversationProcessingStep(processingRunId, "TRANSCRIPTION_POLL_TIMEOUT", true);
  throw new FatalError("TRANSCRIPTION_POLL_TIMEOUT");
}
