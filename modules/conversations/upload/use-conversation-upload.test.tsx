import { StrictMode, type PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import useConversationUpload from "./use-conversation-upload";

const actions = vi.hoisted(() => ({
  prepare: vi.fn(),
  prepareRecording: vi.fn(),
  complete: vi.fn(),
  discard: vi.fn(),
}));

vi.mock("../lib/actions/conversation.actions", () => ({
  prepareConversationUploadAction: actions.prepare,
  prepareConversationRecordingAction: actions.prepareRecording,
  completeConversationUploadAction: actions.complete,
  discardConversationUploadAction: actions.discard,
}));

const policy = {
  maximumBytes: 25 * 1024 * 1024,
  maximumDurationMs: 600_000,
  grantExpiresInSeconds: 900,
  permittedMimeTypes: ["audio/mpeg", "application/octet-stream"],
};

const prepared = {
  conversationId: "conversation-a",
  grantId: "grant-a",
  version: 1,
  uploadUrl: "https://storage.example/upload",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  requiredContentType: "audio/mpeg",
  policy,
};

class SuccessfulXMLHttpRequest {
  static sends = 0;
  status = 200;
  upload = { addEventListener: vi.fn() };
  private listeners = new Map<string, EventListener>();

  open() {}
  setRequestHeader() {}
  addEventListener(type: string, listener: EventListener) { this.listeners.set(type, listener); }
  send() {
    SuccessfulXMLHttpRequest.sends++;
    queueMicrotask(() => this.listeners.get("load")?.(new Event("load")));
  }
  abort() { this.listeners.get("abort")?.(new Event("abort")); }
}

function wrapper({ children }: PropsWithChildren) {
  return <NextIntlClientProvider locale="en" messages={messages}>{children}</NextIntlClientProvider>;
}

function strictWrapper({ children }: PropsWithChildren) {
  return <StrictMode>{wrapper({ children })}</StrictMode>;
}

function values() {
  return {
    locale: "en" as const,
    file: new File([new Uint8Array([1, 2, 3])], "call.mp3", {
      type: "audio/mpeg",
      lastModified: 123,
    }),
  };
}

describe("conversation upload recovery", () => {
  beforeEach(() => {
    SuccessfulXMLHttpRequest.sends = 0;
    vi.stubGlobal("XMLHttpRequest", SuccessfulXMLHttpRequest);
    actions.prepare.mockReset();
    actions.prepareRecording.mockReset();
    actions.complete.mockReset();
    actions.discard.mockReset();
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it("continues handling asynchronous responses after the StrictMode effect cycle", async () => {
    actions.prepare.mockResolvedValue({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "INTERNAL_ERROR" },
    });
    const { result } = renderHook(() => useConversationUpload({
      onSuccess: vi.fn(), onLockChange: vi.fn(), policy,
    }), { wrapper: strictWrapper });

    await act(async () => { await result.current.submit(values()); });

    expect(result.current.stage).toBe("failed");
    expect(result.current.error).toBe(messages.conversations.errors.INTERNAL_ERROR);
  });

  it("reuses the same prepare idempotency key after an uncertain response", async () => {
    actions.prepare.mockRejectedValue(new Error("response lost"));
    const { result } = renderHook(() => useConversationUpload({
      onSuccess: vi.fn(), onLockChange: vi.fn(), policy,
    }), { wrapper });
    const input = values();

    await act(async () => { await result.current.submit(input); });
    await act(async () => { await result.current.submit(input); });

    expect(actions.prepare).toHaveBeenCalledTimes(2);
    expect(actions.prepare.mock.calls[1][0].idempotencyKey)
      .toBe(actions.prepare.mock.calls[0][0].idempotencyKey);
  });

  it("retries an uncertain completion without uploading the bytes again", async () => {
    const onSuccess = vi.fn();
    actions.prepare.mockResolvedValue({ success: true, data: prepared });
    actions.complete
      .mockRejectedValueOnce(new Error("completion response lost"))
      .mockResolvedValueOnce({
        success: true,
        data: { conversationId: "conversation-a", version: 2 },
      });
    const { result } = renderHook(() => useConversationUpload({
      onSuccess, onLockChange: vi.fn(), policy,
    }), { wrapper });

    await act(async () => { await result.current.submit(values()); });
    expect(result.current.canRetry).toBe(true);
    await act(async () => { await result.current.retry(); });

    expect(SuccessfulXMLHttpRequest.sends).toBe(1);
    expect(actions.complete).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledWith({ conversationId: "conversation-a", version: 2 });
  });

  it("unlocks a definitive stored-object mismatch instead of offering a futile retry", async () => {
    actions.prepare.mockResolvedValue({ success: true, data: prepared });
    actions.complete.mockResolvedValue({
      success: false,
      error: { code: "UPLOAD_MISMATCH", message: "UPLOAD_MISMATCH" },
    });
    const { result } = renderHook(() => useConversationUpload({
      onSuccess: vi.fn(), onLockChange: vi.fn(), policy,
    }), { wrapper });

    await act(async () => { await result.current.submit(values()); });

    expect(result.current.stage).toBe("failed");
    expect(result.current.canRetry).toBe(false);
    expect(result.current.locked).toBe(false);
  });

  it("uses the recording preparation action for microphone audio", async () => {
    actions.prepareRecording.mockResolvedValue({ success: true, data: prepared });
    actions.complete.mockResolvedValue({
      success: true,
      data: { conversationId: "conversation-a", version: 2 },
    });
    const { result } = renderHook(() => useConversationUpload({
      onSuccess: vi.fn(), onLockChange: vi.fn(), policy, sourceType: "microphone",
    }), { wrapper });

    await act(async () => { await result.current.submit(values()); });

    expect(actions.prepareRecording).toHaveBeenCalledWith(expect.objectContaining({
      originalFilename: "call.mp3",
    }));
    expect(actions.prepare).not.toHaveBeenCalled();
  });
});
