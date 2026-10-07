import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useContinueConversationExtraction from "./use-continue-conversation-extraction";

const mocks = vi.hoisted(() => ({ proceed: vi.fn() }));
const translate = Object.assign((key: string) => key, { has: () => true });
vi.mock("next-intl", () => ({ useTranslations: () => translate }));
vi.mock("../lib/actions/extraction.actions", () => ({ continueConversationExtractionAction: mocks.proceed }));

describe("useContinueConversationExtraction", () => {
  beforeEach(() => vi.clearAllMocks());
  it("collapses duplicate continuation clicks and refreshes on success", async () => {
    mocks.proceed.mockResolvedValue({ success: true, data: { version: 5 } });
    const refresh = vi.fn();
    const { result } = renderHook(() => useContinueConversationExtraction(refresh));
    await act(async () => { await Promise.all([result.current.execute("conversation-a", 4), result.current.execute("conversation-a", 4)]); });
    expect(mocks.proceed).toHaveBeenCalledOnce();
    expect(mocks.proceed).toHaveBeenCalledWith({ conversationId: "conversation-a", expectedVersion: 4 });
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("shows safe translated continuation failure without refreshing", async () => {
    mocks.proceed.mockResolvedValue({ success: false, error: { code: "STALE_VERSION", message: "private details" } });
    const refresh = vi.fn();
    const { result } = renderHook(() => useContinueConversationExtraction(refresh));
    await act(async () => { await result.current.execute("conversation-a", 4); });
    expect(result.current.error).toBe("errors.STALE_VERSION");
    expect(refresh).not.toHaveBeenCalled();
  });
});
