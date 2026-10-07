import { describe, expect, it } from "vitest";
import type { ConversationDetails } from "../lib/types/conversation.types";
import { getConversationProcessingView } from "./conversation-processing-view";

function conversation(overrides: Partial<ConversationDetails> = {}): ConversationDetails {
  return {
    id: "conversation-a",
    sourceType: "upload",
    locale: "en",
    status: "audio_ready",
    version: 1,
    durationMs: 1_000,
    originalFilename: "sample.webm",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    audio: null,
    credits: { available: 9, reserved: 1, consumed: 0 },
    processingRun: null,
    transcript: null,
    ...overrides,
  };
}

describe("getConversationProcessingView", () => {
  it("identifies a preserved review after failed reprocessing without enabling initial processing", () => {
    const view = getConversationProcessingView(conversation({ status: "needs_review",
      processingRun: { id: "run-a", status: "failed", stage: "extracting", retryable: false, failureCode: "EXTRACTION_INVALID_RESPONSE" } }));
    expect(view.hasPreservedReview).toBe(true);
    expect(view.canStart).toBe(false);
    expect(getConversationProcessingView(conversation({ status: "completed" })).hasPreservedReview).toBe(false);
  });
  it("allows processing only for audio-ready conversations with an available credit", () => {
    expect(getConversationProcessingView(conversation()).canStart).toBe(true);
    expect(getConversationProcessingView(conversation({ credits: { available: 0, reserved: 1, consumed: 0 } })).canStart).toBe(false);
    expect(getConversationProcessingView(conversation({ status: "transcribed" })).canStart).toBe(false);
    expect(getConversationProcessingView(conversation({
      status: "failed",
      processingRun: { id: "run-a", status: "failed", stage: "transcribing", retryable: false, failureCode: "TRANSCRIPTION_FAILED" },
    })).canStart).toBe(true);
    expect(getConversationProcessingView(conversation({
      status: "failed",
      processingRun: { id: "run-a", status: "running", stage: "transcribing", retryable: true, failureCode: null },
    })).canStart).toBe(false);
  });

  it("keeps the persisted run and transcript contracts intact", () => {
    const details = conversation({
      status: "transcribed",
      processingRun: { id: "run-a", status: "running", stage: "extracting", retryable: false, failureCode: null },
      transcript: {
        text: "Hello   world",
        locale: "en",
        completedAt: "2026-01-01T00:01:00.000Z",
        diarizationStatus: "unavailable",
        warningCode: "ALIGNMENT_FALLBACK",
        segments: [{ id: "evidence-a", startMs: null, endMs: null, startOffset: 0, endOffset: 13, text: "Hello   world", speakerId: null, confidence: null }],
      },
    });
    const view = getConversationProcessingView(details);
    expect(view.run?.status).toBe("running");
    expect(view.transcript?.segments[0]).toMatchObject({ startMs: null, endMs: null, text: "Hello   world" });
  });
});
