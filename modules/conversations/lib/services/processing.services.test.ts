import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    processingRun: { findFirst: vi.fn(), create: vi.fn() },
    conversation: { findFirst: vi.fn(), updateMany: vi.fn() },
    creditReservation: { create: vi.fn() },
    creditEntry: { create: vi.fn() },
    processingCheckpoint: { create: vi.fn() },
    outboxEvent: { create: vi.fn(), findUnique: vi.fn() },
    proposalRevision: { findFirst: vi.fn(), update: vi.fn() },
    recordPlan: { updateMany: vi.fn() },
    auditEvent: { create: vi.fn() },
  };
  return {
    tx,
    resolve: vi.fn(),
    rootRunFindFirst: vi.fn(),
    transaction: vi.fn(async (operation: (value: typeof tx) => unknown) => operation(tx)),
    initializeCredits: vi.fn(),
    balance: vi.fn(),
    dispatch: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({ resolveCurrentWorkspace: mocks.resolve }));
vi.mock("@/lib/records/record-policy", () => ({ assertRecordAccess: vi.fn() }));
vi.mock("@/lib/persistence/prisma", () => ({
  prisma: {
    processingRun: { findFirst: mocks.rootRunFindFirst },
    $transaction: mocks.transaction,
  },
}));
vi.mock("./credit.services", () => ({
  initializeWorkspaceCredits: mocks.initializeCredits,
  getWorkspaceCreditBalance: mocks.balance,
}));
vi.mock("@/lib/workflow/conversation-processing.dispatcher", () => ({
  dispatchConversationProcessingOutboxEvent: mocks.dispatch,
}));
vi.mock("@/lib/workflow/conversation-transcription.workflow", () => ({ failConversationProcessingStep: vi.fn() }));

import { startConversationProcessing, startConversationReprocessing, continueConversationExtraction } from "./processing.services";

const input = {
  conversationId: "conversation-a",
  expectedVersion: 2,
  idempotencyKey: "37fd4cb8-d9e1-4bd5-8314-0f5d3e2c6191",
};

function readyConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: "conversation-a",
    version: 2,
    status: "AUDIO_READY",
    deletionState: "ACTIVE",
    correlationId: "correlation-a",
    audioArtifact: { verificationState: "VERIFIED", deletionState: "ACTIVE" },
    ...overrides,
  };
}

describe("processing start service", () => {
  beforeEach(() => {
    process.env.CONVERSATION_SPEECH_ENABLED = "true";
    process.env.CONVERSATION_EXTRACTION_ENABLED = "true";
    process.env.GROQ_API_KEY = "fixture-key";
    mocks.resolve.mockResolvedValue({
      session: { user: { id: "user-a" } },
      workspace: { id: "workspace-a" },
    });
    mocks.rootRunFindFirst.mockResolvedValue(null);
    mocks.tx.processingRun.findFirst.mockResolvedValue(null);
    mocks.tx.conversation.findFirst.mockResolvedValue(readyConversation());
    mocks.tx.conversation.updateMany.mockResolvedValue({ count: 1 });
    mocks.balance.mockResolvedValue({ available: 10, reserved: 0, consumed: 0 });
    mocks.dispatch.mockResolvedValue(true);
  });

  it("fails closed when speech is disabled", async () => {
    process.env.CONVERSATION_SPEECH_ENABLED = "false";
    await expect(startConversationProcessing(input)).resolves.toMatchObject({
      success: false,
      error: { code: "SPEECH_DISABLED" },
    });
    expect(mocks.tx.creditReservation.create).not.toHaveBeenCalled();
  });

  it("rejects exhausted credit and unverified audio without reserving", async () => {
    mocks.balance.mockResolvedValueOnce({ available: 0, reserved: 10, consumed: 0 });
    await expect(startConversationProcessing(input)).resolves.toMatchObject({
      success: false,
      error: { code: "INSUFFICIENT_CREDITS" },
    });
    expect(mocks.tx.creditReservation.create).not.toHaveBeenCalled();

    mocks.tx.conversation.findFirst.mockResolvedValueOnce(readyConversation({
      audioArtifact: { verificationState: "PENDING", deletionState: "ACTIVE" },
    }));
    await expect(startConversationProcessing(input)).resolves.toMatchObject({
      success: false,
      error: { code: "AUDIO_NOT_VERIFIED" },
    });
    expect(mocks.tx.creditReservation.create).not.toHaveBeenCalled();
  });

  it("creates one atomic run, reservation, reserve entry, checkpoint and outbox delivery", async () => {
    const result = await startConversationProcessing(input);
    expect(result).toMatchObject({
      success: true,
      data: { conversationId: "conversation-a", version: 3 },
    });
    expect(mocks.tx.processingRun.create).toHaveBeenCalledOnce();
    expect(mocks.tx.creditReservation.create).toHaveBeenCalledOnce();
    expect(mocks.tx.creditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "RESERVE", quantity: 1 }),
    });
    expect(mocks.tx.processingCheckpoint.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ stage: "QUEUED", attempt: 1 }),
    });
    expect(mocks.tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: "conversation.processing.requested" }),
    });
    expect(mocks.dispatch).toHaveBeenCalledOnce();
  });

  it("deduplicates a replay/active run without a second reservation", async () => {
    mocks.rootRunFindFirst.mockResolvedValue({
      id: "run-existing",
      conversationId: "conversation-a",
      conversation: { version: 3 },
    });
    await expect(startConversationProcessing(input)).resolves.toEqual({
      success: true,
      data: { processingRunId: "run-existing", conversationId: "conversation-a", version: 3 },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.tx.creditReservation.create).not.toHaveBeenCalled();
  });

  it("requires the extraction profile before reserving credit", async () => {
    process.env.CONVERSATION_EXTRACTION_ENABLED = "false";
    await expect(startConversationProcessing(input)).resolves.toMatchObject({ success: false, error: { code: "EXTRACTION_DISABLED" } });
    expect(mocks.tx.creditReservation.create).not.toHaveBeenCalled();
  });

  it("reuses a persisted transcript on terminal retry without requiring speech or retranscribing", async () => {
    process.env.CONVERSATION_SPEECH_ENABLED = "false";
    mocks.tx.conversation.findFirst.mockResolvedValue(readyConversation({ status: "FAILED", originalTranscript: { id: "transcript-a" } }));
    await expect(startConversationProcessing(input)).resolves.toMatchObject({ success: true });
    expect(mocks.tx.outboxEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: "conversation.extraction.requested" }) });
    expect(mocks.tx.creditReservation.create).toHaveBeenCalledOnce();
  });

  it("continues an existing transcribed run using the existing reservation and durable event", async () => {
    mocks.tx.conversation.findFirst.mockResolvedValue(readyConversation({ status: "TRANSCRIBED", originalTranscript: { id: "transcript-a" }, currentRun: { id: "run-a", status: "RUNNING", correlationId: "correlation-a", reservation: { status: "ACTIVE" } } }));
    mocks.tx.outboxEvent.create.mockResolvedValue({ id: "event-a" });
    await expect(continueConversationExtraction({ conversationId: input.conversationId, expectedVersion: 2 })).resolves.toMatchObject({ success: true, data: { processingRunId: "run-a" } });
    expect(mocks.tx.creditReservation.create).not.toHaveBeenCalled();
    expect(mocks.tx.processingRun.create).not.toHaveBeenCalled();
    expect(mocks.dispatch).toHaveBeenCalledWith("event-a");
    expect(mocks.tx.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "EXTRACTING", version: { increment: 1 } } }));
  });

  it("replays an already queued continuation despite the original expected version", async () => {
    mocks.tx.conversation.findFirst.mockResolvedValue(readyConversation({ status: "EXTRACTING", version: 3, originalTranscript: { id: "transcript-a" }, currentRun: { id: "run-a", status: "RUNNING", correlationId: "correlation-a", reservation: { status: "ACTIVE" } } }));
    mocks.tx.outboxEvent.findUnique.mockResolvedValue({ id: "event-a" });
    await expect(continueConversationExtraction({ conversationId: input.conversationId, expectedVersion: 2 })).resolves.toMatchObject({ success: true, data: { processingRunId: "run-a", version: 3 } });
    expect(mocks.tx.outboxEvent.create).not.toHaveBeenCalled();
    expect(mocks.tx.creditReservation.create).not.toHaveBeenCalled();
  });

  it("never starts a replacement extraction for a conversation with a published proposal", async () => {
    mocks.tx.conversation.findFirst.mockResolvedValue(readyConversation({ status: "FAILED", currentProposalRevisionId: "revision-a", originalTranscript: { id: "transcript-a" } }));
    await expect(startConversationProcessing(input)).resolves.toMatchObject({ success: false, error: { code: "INVALID_STATUS_TRANSITION" } });
    expect(mocks.tx.processingRun.create).not.toHaveBeenCalled();
    expect(mocks.tx.creditReservation.create).not.toHaveBeenCalled();
  });

  it("starts explicit reprocessing with a fresh credit, preserving the current revision and invalidating readiness/plans", async () => {
    mocks.tx.conversation.findFirst.mockResolvedValue(readyConversation({ status: "READY", currentProposalRevisionId: "revision-a",
      currentRunId: "run-old", originalTranscript: { id: "transcript-a" } }));
    process.env.CONVERSATION_SPEECH_ENABLED = "false";
    expect(await startConversationReprocessing(input)).toMatchObject({ success: true });
    expect(mocks.tx.creditReservation.create).toHaveBeenCalledOnce();
    expect(mocks.tx.proposalRevision.update).toHaveBeenCalledWith({ where: { id: "revision-a" }, data: { status: "CANDIDATE", readyAt: null, readyByUserId: null } });
    expect(mocks.tx.recordPlan.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "INVALIDATED", invalidatedAt: expect.any(Date) } }));
    expect(mocks.tx.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: {
      status: "EXTRACTING", currentRunId: expect.any(String), version: { increment: 1 },
    } }));
    expect(mocks.tx.outboxEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: "conversation.extraction.requested" }) });
  });

  it.each(["COMPLETED", "EXTRACTING", "AUDIO_READY"])("rejects new reprocessing in %s", async (status) => {
    mocks.tx.conversation.findFirst.mockResolvedValue(readyConversation({ status, currentProposalRevisionId: "revision-a",
      originalTranscript: { id: "transcript-a" } }));
    expect(await startConversationReprocessing(input)).toMatchObject({ success: false, error: { code: "INVALID_STATUS_TRANSITION" } });
    expect(mocks.tx.creditReservation.create).not.toHaveBeenCalled();
  });

  it("rejects an unresolved candidate and insufficient credit without invalidating existing readiness", async () => {
    mocks.tx.conversation.findFirst.mockResolvedValue(readyConversation({ status: "READY", currentProposalRevisionId: "revision-a",
      currentRunId: "run-old", originalTranscript: { id: "transcript-a" } }));
    mocks.tx.proposalRevision.findFirst.mockResolvedValueOnce({ id: "candidate-a" });
    expect(await startConversationReprocessing(input)).toMatchObject({ success: false, error: { code: "REPROCESSING_CANDIDATE_PENDING" } });
    mocks.balance.mockResolvedValueOnce({ available: 0, reserved: 0, consumed: 10 });
    expect(await startConversationReprocessing(input)).toMatchObject({ success: false, error: { code: "INSUFFICIENT_CREDITS" } });
    expect(mocks.tx.proposalRevision.update).not.toHaveBeenCalled();
    expect(mocks.tx.recordPlan.updateMany).not.toHaveBeenCalled();
  });
});
