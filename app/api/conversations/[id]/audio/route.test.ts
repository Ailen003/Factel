import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ access: vi.fn(), read: vi.fn() }));
vi.mock("@/modules/conversations/lib/services/conversation.services", () => ({
  getConversationAudioObject: mocks.access,
}));
vi.mock("@/lib/storage/storage.service", () => ({ readObjectBytes: mocks.read }));

import { GET } from "./route";

describe("authorized conversation audio route", () => {
  beforeEach(() => {
    mocks.access.mockResolvedValue({
      success: true,
      data: { storageKey: "private/audio", mimeType: "audio/mpeg", byteSize: 10 },
    });
    mocks.read.mockResolvedValue({
      bytes: new Uint8Array([3, 4, 5]),
      byteSize: 3,
      contentType: "audio/mpeg",
      contentRange: "bytes 2-4/10",
      etag: '"etag"',
    });
  });

  it("serves a single authorized byte range privately", async () => {
    const request = new Request("http://localhost/api/conversations/conversation-a/audio", {
      headers: { Range: "bytes=2-4" },
    });
    const response = await GET(request, { params: Promise.resolve({ id: "conversation-a" }) });
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.read).toHaveBeenCalledWith("private/audio", 3, { start: 2, end: 4 });
  });

  it("hides cross-workspace/not-found details and rejects multiple ranges", async () => {
    mocks.access.mockResolvedValueOnce({ success: false, error: { code: "NOT_FOUND", message: "NOT_FOUND" } });
    const hidden = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: "other" }),
    });
    expect(hidden.status).toBe(404);

    const invalid = await GET(new Request("http://localhost/x", {
      headers: { Range: "bytes=0-1,4-5" },
    }), { params: Promise.resolve({ id: "conversation-a" }) });
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get("content-range")).toBe("bytes */10");
  });

  it.each([
    "TEMPORARY_PASSWORD_CHANGE_REQUIRED",
    "TEMPORARY_PASSWORD_EXPIRED",
  ])("blocks pending temporary credentials with %s", async (code) => {
    mocks.access.mockResolvedValueOnce({ success: false, error: { code, message: code } });

    const response = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: "conversation-a" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: { code, message: code } });
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
