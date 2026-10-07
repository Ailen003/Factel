import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    processingRun: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    conversation: { update: vi.fn(), updateMany: vi.fn() },
    processingCheckpoint: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    providerInvocation: { upsert: vi.fn(), updateMany: vi.fn() },
  };
  return { tx, extract: vi.fn(), publish: vi.fn(), fail: vi.fn(), transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)) };
});
vi.mock("workflow", () => ({ FatalError: class FatalError extends Error {}, sleep: vi.fn() }));
vi.mock("@/lib/persistence/prisma", () => ({ prisma: { $transaction: mocks.transaction, providerInvocation: mocks.tx.providerInvocation } }));
vi.mock("@/lib/ai/conversation-extraction", () => ({ extractConversation: mocks.extract }));
vi.mock("@/modules/conversations/lib/services/proposal.services", () => ({ publishExtraction: mocks.publish }));
vi.mock("./conversation-transcription.workflow", () => ({ failConversationProcessingStep: mocks.fail }));
import { extractAndPublishConversationStep } from "./conversation-extraction.workflow";
import { ExtractionError } from "@/lib/ai/extraction-profile";

function authority() {
  return {
    id: "run-a", workspaceId: "workspace-a", status: "RUNNING", reservation: { status: "ACTIVE" },
    workspace: { lifecycle: "ACTIVE", owner: { status: "active", banned: false, role: "trial_user" } },
    conversation: { id: "conversation-a", deletionState: "ACTIVE", currentRunId: "run-a", currentProposalRevisionId: null,
      originalTranscript: { text: "Call Ada", language: "en", evidence: [{ stableEvidenceId: "e1", startOffset: 0, endOffset: 8 }] } },
    checkpoints: [] as Array<{ attempt: number; outcome: string; updatedAt: Date }>,
  };
}

describe("durable extraction publication", () => {
  beforeEach(() => {
    vi.stubEnv("CONVERSATION_EXTRACTION_ENABLED", "true");
    vi.stubEnv("GROQ_API_KEY", "fixture-key");
    vi.stubEnv("CONVERSATION_EXTRACTION_MAX_ATTEMPTS", "2");
    mocks.tx.processingRun.findUnique.mockResolvedValue(authority());
    mocks.tx.processingRun.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.processingCheckpoint.findFirst.mockResolvedValue({ id: "checkpoint-a" });
    mocks.tx.processingCheckpoint.updateMany.mockResolvedValue({ count: 1 });
    mocks.extract.mockResolvedValue({ extraction: { draft: "private-content" }, latencyMs: 5, usage: { inputTokens: 1, outputTokens: 2 } });
    mocks.publish.mockResolvedValue("revision-a");
  });

  it("commits a proposal and returns only a status, never provider content", async () => {
    await expect(extractAndPublishConversationStep("run-a")).resolves.toBe("done");
    expect(mocks.extract).toHaveBeenCalledWith({ language: "en", evidence: [{ id: "e1", text: "Call Ada" }] });
    expect(mocks.publish).toHaveBeenCalledWith("run-a", { draft: "private-content" }, { attempt: 1, leaseReference: expect.any(String), expiresAt: expect.any(Date) });
    expect(mocks.tx.processingCheckpoint.create).toHaveBeenCalledWith({ data: expect.objectContaining({ attempt: 1, stage: "EXTRACTING" }) });
  });

  it("does not call providers for deleted conversations or settled runs", async () => {
    const run = authority(); run.conversation.deletionState = "DELETED";
    mocks.tx.processingRun.findUnique.mockResolvedValue(run);
    await expect(extractAndPublishConversationStep("run-a")).resolves.toBe("stopped");
    run.conversation.deletionState = "ACTIVE"; run.status = "SUCCEEDED";
    await expect(extractAndPublishConversationStep("run-a")).resolves.toBe("done");
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it("does not issue a duplicate call while a persisted lease is active", async () => {
    const run = authority(); run.checkpoints = [{ attempt: 1, outcome: "PENDING", updatedAt: new Date() }];
    mocks.tx.processingRun.findUnique.mockResolvedValue(run);
    await expect(extractAndPublishConversationStep("run-a")).resolves.toBe("busy");
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it("fails an uncertain expired lease without repeating a possibly paid invocation", async () => {
    const run = authority(); run.checkpoints = [{ attempt: 1, outcome: "PENDING", updatedAt: new Date(0) }];
    mocks.tx.processingRun.findUnique.mockResolvedValue(run);
    await expect(extractAndPublishConversationStep("run-a")).rejects.toThrow("EXTRACTION_SUBMISSION_UNCERTAIN");
    expect(mocks.extract).not.toHaveBeenCalled();
    expect(mocks.fail).toHaveBeenCalledWith("run-a", "EXTRACTION_SUBMISSION_UNCERTAIN", false, { expiredBefore: expect.any(Date) });
  });

  it("reschedules one explicit transient failure without restoring the reservation", async () => {
    mocks.extract.mockRejectedValueOnce(new ExtractionError("EXTRACTION_PROVIDER_UNAVAILABLE", true));
    await expect(extractAndPublishConversationStep("run-a")).resolves.toBe("retry");
    expect(mocks.tx.processingCheckpoint.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { outcome: "RETRYABLE_FAILURE", safeError: "EXTRACTION_PROVIDER_UNAVAILABLE" } }));
    expect(mocks.fail).not.toHaveBeenCalled();
  });

  it("recovers a JSON rejection on the second attempt using the same run and preserving the current proposal", async () => {
    const run = { ...authority(), conversation: { ...authority().conversation, currentProposalRevisionId: "human-revision" } };
    mocks.tx.processingRun.findUnique.mockResolvedValue(run);
    mocks.extract.mockRejectedValueOnce(new ExtractionError("EXTRACTION_INVALID_RESPONSE", true));
    expect(await extractAndPublishConversationStep("run-a")).toBe("retry");
    expect(mocks.fail).not.toHaveBeenCalled(); expect(mocks.publish).not.toHaveBeenCalled();
    run.checkpoints = [{ attempt: 1, outcome: "RETRYABLE_FAILURE", updatedAt: new Date() }];
    expect(await extractAndPublishConversationStep("run-a")).toBe("done");
    expect(mocks.publish).toHaveBeenCalledOnce();
    expect(mocks.publish).toHaveBeenCalledWith("run-a", expect.anything(), expect.objectContaining({ attempt: 2 }));
    expect(mocks.tx.conversation.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ currentProposalRevisionId: expect.anything() }) }));
  });

  it("terminalizes repeated JSON rejection at the configured attempt limit", async () => {
    const run = authority(); run.checkpoints = [{ attempt: 1, outcome: "RETRYABLE_FAILURE", updatedAt: new Date() }];
    mocks.tx.processingRun.findUnique.mockResolvedValue(run);
    mocks.extract.mockRejectedValueOnce(new ExtractionError("EXTRACTION_INVALID_RESPONSE", true));
    await expect(extractAndPublishConversationStep("run-a")).rejects.toThrow("EXTRACTION_INVALID_RESPONSE");
    expect(mocks.fail).toHaveBeenCalledWith("run-a", "EXTRACTION_INVALID_RESPONSE", true, expect.objectContaining({ attempt: 2 }));
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("terminalizes failed publication without retrying the provider or recording raw diagnostics", async () => {
    mocks.publish.mockRejectedValueOnce(new Error("private details"));
    await expect(extractAndPublishConversationStep("run-a")).rejects.toThrow("EXTRACTION_PUBLICATION_FAILED");
    expect(mocks.extract).toHaveBeenCalledOnce();
    expect(mocks.fail).toHaveBeenCalledWith("run-a", "EXTRACTION_PUBLICATION_FAILED", false, expect.objectContaining({ attempt: 1, leaseReference: expect.any(String) }));
  });

  it("does not publish or update invocation metadata when a worker loses its lease", async () => {
    mocks.tx.processingCheckpoint.findFirst.mockResolvedValue(null);
    await expect(extractAndPublishConversationStep("run-a")).resolves.toBe("stopped");
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.tx.providerInvocation.updateMany).not.toHaveBeenCalled();
  });

  it("does not publish when deletion or settlement wins after the provider returns", async () => {
    mocks.tx.processingRun.updateMany.mockResolvedValue({ count: 0 });
    await expect(extractAndPublishConversationStep("run-a")).resolves.toBe("stopped");
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("does not revive a checkpoint when transient failure arrives after cancellation", async () => {
    mocks.extract.mockRejectedValueOnce(new ExtractionError("EXTRACTION_PROVIDER_UNAVAILABLE", true));
    mocks.tx.processingCheckpoint.updateMany.mockResolvedValue({ count: 0 });
    await expect(extractAndPublishConversationStep("run-a")).resolves.toBe("stopped");
    expect(mocks.tx.providerInvocation.updateMany).not.toHaveBeenCalled();
    expect(mocks.fail).not.toHaveBeenCalled();
  });

  it("blocks provider calls after workspace access is revoked", async () => {
    const run = authority(); run.workspace.owner.banned = true;
    mocks.tx.processingRun.findUnique.mockResolvedValue(run);
    await expect(extractAndPublishConversationStep("run-a")).rejects.toThrow("EXTRACTION_AUTHORITY_REVOKED");
    expect(mocks.extract).not.toHaveBeenCalled();
  });
});
