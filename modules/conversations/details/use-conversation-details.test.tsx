import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationDetails } from "../lib/types/conversation.types";
import useConversationDetails from "./use-conversation-details";

const mocks = vi.hoisted(() => ({ getConversationByIdAction: vi.fn() }));
const translate = Object.assign((key: string) => key, { has: () => true });

vi.mock("next-intl", () => ({ useTranslations: () => translate }));
vi.mock("../lib/actions/conversation.actions", () => ({
  getConversationByIdAction: mocks.getConversationByIdAction,
}));

function details(status: ConversationDetails["status"]): ConversationDetails {
  return {
    id: "conversation-a", sourceType: "upload", locale: "en", status, version: 1,
    durationMs: 1_000, originalFilename: "sample.webm",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    audio: null, credits: { available: 9, reserved: 1, consumed: 0 },
    processingRun: status === "transcribed" ? null : { id: "run-a", status: "running", stage: "transcribing", retryable: false, failureCode: null },
    transcript: null,
  };
}

describe("useConversationDetails", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.getConversationByIdAction.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("polls every three seconds while processing and stops at a terminal detail status", async () => {
    mocks.getConversationByIdAction
      .mockResolvedValueOnce({ success: true, data: details("transcribing") })
      .mockResolvedValueOnce({ success: true, data: details("transcribed") });
    const { result } = renderHook(() => useConversationDetails("conversation-a"));

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.conversation?.status).toBe("transcribing");
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(result.current.conversation?.status).toBe("transcribed");
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    expect(mocks.getConversationByIdAction).toHaveBeenCalledTimes(2);
  });

  it("continues through the transcribed handoff while its durable run is still active", async () => {
    const transcribed = { ...details("transcribed"), processingRun: details("transcribing").processingRun };
    mocks.getConversationByIdAction
      .mockResolvedValueOnce({ success: true, data: details("transcribing") })
      .mockResolvedValueOnce({ success: true, data: transcribed })
      .mockResolvedValueOnce({ success: true, data: details("extracting") })
      .mockResolvedValueOnce({ success: true, data: details("needs_review") });
    const { result } = renderHook(() => useConversationDetails("conversation-a"));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    for (const status of ["transcribed", "extracting", "needs_review"]) {
      await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
      expect(result.current.conversation?.status).toBe(status);
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    expect(mocks.getConversationByIdAction).toHaveBeenCalledTimes(4);
  });

  it("retains loaded detail on a quiet refresh failure", async () => {
    const loaded = details("needs_review");
    mocks.getConversationByIdAction.mockResolvedValueOnce({ success: true, data: loaded }).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useConversationDetails("conversation-a"));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await result.current.reload(true); });
    expect(result.current.conversation).toBe(loaded);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("errors.INTERNAL_ERROR");
  });
});
