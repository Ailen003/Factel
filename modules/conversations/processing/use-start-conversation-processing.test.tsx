import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useStartConversationProcessing from "./use-start-conversation-processing";

const mocks = vi.hoisted(() => ({ start: vi.fn() }));
const translate = Object.assign((key: string) => key, { has: () => true });

vi.mock("next-intl", () => ({ useTranslations: () => translate }));
vi.mock("../lib/actions/conversation.actions", () => ({
  startConversationProcessingAction: mocks.start,
}));

describe("useStartConversationProcessing", () => {
  afterEach(() => {
    mocks.start.mockReset();
    vi.unstubAllGlobals();
  });

  it("collapses a double click into one idempotent start", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    mocks.start.mockResolvedValue({
      success: true,
      data: { processingRunId: "run-a", conversationId: "conversation-a", version: 2 },
    });
    const onStarted = vi.fn();
    const { result } = renderHook(() => useStartConversationProcessing(onStarted));

    await act(async () => {
      await Promise.all([
        result.current.execute("conversation-a", 1),
        result.current.execute("conversation-a", 1),
      ]);
    });

    expect(mocks.start).toHaveBeenCalledOnce();
    expect(mocks.start).toHaveBeenCalledWith({
      conversationId: "conversation-a",
      expectedVersion: 1,
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    });
    expect(onStarted).toHaveBeenCalledOnce();
  });

  it("maps a safe service code for an accessible inline error", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "22222222-2222-4222-8222-222222222222" });
    mocks.start.mockResolvedValue({ success: false, error: { code: "INSUFFICIENT_CREDITS", message: "hidden" } });
    const { result } = renderHook(() => useStartConversationProcessing(vi.fn()));
    await act(async () => { await result.current.execute("conversation-a", 1); });
    expect(result.current.error).toBe("errors.INSUFFICIENT_CREDITS");
  });
});
