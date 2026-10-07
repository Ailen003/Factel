import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useConversationRecorder, { getSupportedRecordingMimeType } from "./use-conversation-recorder";

const policy = {
  maximumBytes: 25 * 1024 * 1024,
  maximumDurationMs: 1_000,
  grantExpiresInSeconds: 900,
  permittedMimeTypes: ["audio/webm"],
};

class FakeTrack {
  onended: (() => void) | null = null;
  stop = vi.fn();
}

class FakeStream {
  readonly track = new FakeTrack();
  getTracks() { return [this.track] as unknown as MediaStreamTrack[]; }
  getAudioTracks() { return [this.track] as unknown as MediaStreamTrack[]; }
}

class FakeMediaRecorder {
  static isTypeSupported = vi.fn((value: string) => value === "audio/webm;codecs=opus");
  static instances: FakeMediaRecorder[] = [];
  state: RecordingState = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() { FakeMediaRecorder.instances.push(this); }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["recorded audio"], { type: "audio/webm" }) } as BlobEvent);
    this.onstop?.();
  }
}

describe("browser conversation recorder", () => {
  let stream: FakeStream;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let createObjectUrl: ReturnType<typeof vi.fn>;
  let revokeObjectUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stream = new FakeStream();
    getUserMedia = vi.fn().mockResolvedValue(stream);
    createObjectUrl = vi.fn(() => "blob:recording");
    revokeObjectUrl = vi.fn();
    FakeMediaRecorder.instances = [];
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("requests permission only when started and produces a local WebM preview after stop", async () => {
    const { result } = renderHook(() => useConversationRecorder(policy));
    expect(getUserMedia).not.toHaveBeenCalled();

    await act(async () => { await result.current.start(); });
    expect(result.current.stage).toBe("recording");
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });

    act(() => result.current.stop());

    expect(result.current.stage).toBe("review");
    expect(result.current.file).toMatchObject({ type: "audio/webm" });
    expect(result.current.previewUrl).toBe("blob:recording");
    expect(stream.track.stop).toHaveBeenCalled();
  });

  it("returns an actionable state when microphone permission is denied", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    const { result } = renderHook(() => useConversationRecorder(policy));

    await act(async () => { await result.current.start(); });

    expect(result.current.stage).toBe("failed");
    expect(result.current.error).toBe("permissionDenied");
  });

  it("keeps captured audio for review when the microphone is interrupted", async () => {
    const { result } = renderHook(() => useConversationRecorder(policy));
    await act(async () => { await result.current.start(); });

    act(() => stream.track.onended?.());

    expect(result.current.stage).toBe("review");
    expect(result.current.notice).toBe("interrupted");
    expect(result.current.file?.size).toBeGreaterThan(0);
  });

  it("stops automatically at the configured duration limit", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useConversationRecorder(policy));
    await act(async () => { await result.current.start(); });

    act(() => { vi.advanceTimersByTime(policy.maximumDurationMs); });

    expect(result.current.stage).toBe("review");
    expect(result.current.notice).toBe("limitReached");
    expect(result.current.elapsedMs).toBe(policy.maximumDurationMs);
  });

  it("revokes the local preview when discarded", async () => {
    const { result } = renderHook(() => useConversationRecorder(policy));
    await act(async () => { await result.current.start(); });
    act(() => result.current.stop());

    act(() => result.current.discard());

    expect(result.current.stage).toBe("idle");
    expect(result.current.file).toBeNull();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:recording");
  });

  it("reports missing MediaRecorder support", () => {
    vi.stubGlobal("MediaRecorder", undefined);
    expect(getSupportedRecordingMimeType()).toBeNull();
  });
});
