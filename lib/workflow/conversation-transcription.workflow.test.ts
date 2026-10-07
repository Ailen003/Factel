import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const provider = { submit: vi.fn(), get: vi.fn(), delete: vi.fn() };
  const tx = {
    processingRun: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    creditReservation: { updateMany: vi.fn() },
    creditEntry: { create: vi.fn() },
    processingCheckpoint: { upsert: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    conversation: { updateMany: vi.fn() },
    providerInvocation: { update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    cleanupTask: { upsert: vi.fn() },
    originalTranscript: { create: vi.fn() },
    transcriptEvidence: { createMany: vi.fn() },
    diarizationVersion: { create: vi.fn() },
    speakerSegment: { createMany: vi.fn() },
  };
  return {
    provider,
    tx,
    runFindUnique: vi.fn(),
    invocationFindFirst: vi.fn(),
    invocationUpdateMany: vi.fn(),
    cleanupUpsert: vi.fn(),
    extract: vi.fn(),
    transaction: vi.fn(async (operation: (value: typeof tx) => unknown) => operation(tx)),
  };
});

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  RetryableError: class RetryableError extends Error {},
  sleep: vi.fn(),
}));
vi.mock("@/lib/persistence/prisma", () => ({
  prisma: {
    processingRun: { findUnique: mocks.runFindUnique },
    providerInvocation: {
      findFirst: mocks.invocationFindFirst,
      updateMany: mocks.invocationUpdateMany,
    },
    cleanupTask: { upsert: mocks.cleanupUpsert },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/speech/assemblyai.provider", () => ({
  createProductionSpeechProvider: () => mocks.provider,
}));
vi.mock("@/lib/storage/storage.service", () => ({
  createSignedDownloadUrl: vi.fn().mockResolvedValue("https://signed.example/audio"),
}));
vi.mock("./conversation-extraction.workflow", () => ({ extractAndPublishConversationStep: mocks.extract }));

import {
  failConversationProcessingStep,
  persistCompletedTranscriptStep,
  submitTranscriptionStep,
  conversationTranscriptionWorkflow,
} from "./conversation-transcription.workflow";

function activeAuthority() {
  return {
    id: "run-a",
    workspaceId: "workspace-a",
    status: "RUNNING",
    conversation: { deletionState: "ACTIVE", currentRunId: "run-a" },
  };
}

describe("conversation transcription workflow steps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockReset().mockImplementation(
      async (operation: (value: typeof mocks.tx) => unknown) => operation(mocks.tx),
    );
    mocks.runFindUnique.mockResolvedValue(activeAuthority());
    mocks.provider.get.mockResolvedValue({ status: "processing" });
    mocks.invocationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.cleanupUpsert.mockResolvedValue({ id: "cleanup-a" });
    mocks.extract.mockResolvedValue("done");
  });

  it("persists provider heartbeat and returns pending for durable polling", async () => {
    await expect(persistCompletedTranscriptStep("run-a", "job-a")).resolves.toBe("pending");
    expect(mocks.provider.get).toHaveBeenCalledWith("job-a");
    expect(mocks.invocationUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { providerUpdatedAt: expect.any(Date) },
    }));
  });

  it("rechecks write authority before contacting the provider and schedules late cleanup", async () => {
    mocks.runFindUnique.mockResolvedValue({
      ...activeAuthority(),
      status: "CANCELLED",
      conversation: { deletionState: "DELETED", currentRunId: null },
    });
    await expect(persistCompletedTranscriptStep("run-a", "job-a")).resolves.toBe("stopped");
    expect(mocks.provider.get).not.toHaveBeenCalled();
    expect(mocks.cleanupUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ providerReference: "job-a" }),
    }));
  });

  it("returns an already persisted transcription without another provider call or version update", async () => {
    mocks.runFindUnique.mockResolvedValue({
      ...activeAuthority(),
      transcript: { id: "transcript-a" },
      conversation: {
        deletionState: "ACTIVE",
        currentRunId: "run-a",
        status: "TRANSCRIBED",
      },
    });
    await expect(persistCompletedTranscriptStep("run-a", "job-a")).resolves.toBe("completed");
    expect(mocks.provider.get).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("retains a durable cleanup reference when job creation succeeds but persistence fails", async () => {
    mocks.runFindUnique
      .mockResolvedValueOnce({
        id: "run-a",
        workspaceId: "workspace-a",
        status: "ACCEPTED",
        conversationId: "conversation-a",
        conversation: {
          locale: "en",
          deletionState: "ACTIVE",
          audioArtifact: {
            storageKey: "audio/a",
            verificationState: "VERIFIED",
            deletionState: "ACTIVE",
          },
        },
      })
      .mockResolvedValue({ workspaceId: "workspace-a" });
    mocks.provider.submit.mockResolvedValue({ jobId: "job-orphan" });
    mocks.transaction.mockRejectedValue(new Error("database unavailable"));

    await expect(submitTranscriptionStep("run-a")).rejects.toThrow();
    expect(mocks.cleanupUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        providerReference: "job-orphan",
        deletionIntent: "orphaned-submission",
      }),
    }));
  });

  it("persists literal text/evidence once and stops at TRANSCRIBED without consuming credit", async () => {
    mocks.provider.get.mockResolvedValue({
      status: "completed",
      text: "Hello there.",
      language: "en",
      completedAt: "2026-09-07T12:00:00.000Z",
      words: [],
      utterances: [{ text: "Hello there.", startMs: 0, endMs: 900, speakerLabel: "A", confidence: 0.9 }],
    });
    mocks.tx.processingRun.findUnique.mockResolvedValue({
      id: "run-a",
      workspaceId: "workspace-a",
      conversationId: "conversation-a",
      status: "RUNNING",
      conversation: { deletionState: "ACTIVE", currentRunId: "run-a" },
      transcript: null,
    });
    await expect(persistCompletedTranscriptStep("run-a", "job-a")).resolves.toBe("completed");
    expect(mocks.tx.originalTranscript.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ text: "Hello there.", language: "en" }),
    });
    expect(mocks.tx.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "TRANSCRIBED" }),
    }));
    expect(mocks.tx.creditReservation.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.creditEntry.create).not.toHaveBeenCalled();
  });

  it("restores an active reservation exactly once across terminal failure replay", async () => {
    mocks.tx.processingRun.findUnique
      .mockResolvedValueOnce({
        id: "run-a",
        workspaceId: "workspace-a",
        conversationId: "conversation-a",
        status: "RUNNING",
        stage: "TRANSCRIBING",
        reservation: { id: "reservation-a", status: "ACTIVE", quantity: 1 },
      })
      .mockResolvedValueOnce({
        id: "run-a",
        workspaceId: "workspace-a",
        conversationId: "conversation-a",
        status: "FAILED",
        stage: "TRANSCRIBING",
        reservation: { id: "reservation-a", status: "RESTORED", quantity: 1 },
      });
    mocks.tx.creditReservation.updateMany.mockResolvedValue({ count: 1 });

    await failConversationProcessingStep("run-a", "SPEECH_TRANSCRIPTION_FAILED", false);
    await failConversationProcessingStep("run-a", "SPEECH_TRANSCRIPTION_FAILED", false);

    expect(mocks.tx.creditEntry.create).toHaveBeenCalledOnce();
    expect(mocks.tx.creditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "RESTORE",
        quantity: 1,
        operationKey: "processing-restore-entry:run-a",
      }),
    });
  });

  it("continues automatically from durable transcription to extraction", async () => {
    mocks.tx.processingRun.findUnique.mockResolvedValue({
      ...activeAuthority(),
      conversation: { deletionState: "ACTIVE", audioArtifact: { verificationState: "VERIFIED", deletionState: "ACTIVE" } },
      providerInvocations: [{ providerJobId: "job-a", status: "SUCCEEDED" }],
    });
    mocks.runFindUnique.mockResolvedValue({
      ...activeAuthority(), transcript: { id: "transcript-a" },
      conversation: { ...activeAuthority().conversation, status: "TRANSCRIBED" },
    });
    await conversationTranscriptionWorkflow("run-a");
    expect(mocks.extract).toHaveBeenCalledWith("run-a");
    expect(mocks.provider.submit).not.toHaveBeenCalled();
  });

  it("cannot restore credits or change invocation state after losing extraction authority", async () => {
    mocks.tx.processingRun.findUnique.mockResolvedValue({
      id: "run-a", workspaceId: "workspace-a", conversationId: "conversation-a", status: "RUNNING", stage: "EXTRACTING",
      reservation: { id: "reservation-a", status: "ACTIVE", quantity: 1 },
    });
    mocks.tx.processingCheckpoint.findFirst.mockResolvedValue(null);
    await failConversationProcessingStep("run-a", "EXTRACTION_PUBLICATION_FAILED", false, { attempt: 1, leaseReference: "old-lease" });
    expect(mocks.tx.creditReservation.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.providerInvocation.updateMany).not.toHaveBeenCalled();
  });
});
