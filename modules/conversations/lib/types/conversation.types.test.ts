import { describe, expect, it } from "vitest";
import {
  parseConversationFilters,
  prepareConversationUploadSchema,
} from "./conversation.types";

describe("conversation public input contracts", () => {
  it("normalizes valid URL filters and falls back atomically for invalid filters", () => {
    expect(parseConversationFilters(new URLSearchParams(
      "page=2&limit=20&sourceType=upload&locale=es&status=audio_ready&sortBy=updatedAt&sortOrder=asc",
    ))).toEqual({
      page: 2,
      limit: 20,
      sourceType: "upload",
      locale: "es",
      status: "audio_ready",
      sortBy: "updatedAt",
      sortOrder: "asc",
    });
    expect(parseConversationFilters({ page: "bad", status: "unknown" })).toEqual({
      page: 1,
      limit: 10,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("rejects browser-controlled provenance and workspace identifiers", () => {
    const base = {
      locale: "es",
      originalFilename: "call.mp3",
      declaredMimeType: "audio/mpeg",
      declaredByteSize: 128,
      idempotencyKey: "37fd4cb8-d9e1-4bd5-8314-0f5d3e2c6191",
    };
    expect(prepareConversationUploadSchema.safeParse(base).success).toBe(true);
    expect(prepareConversationUploadSchema.safeParse({ ...base, sourceType: "microphone" }).success).toBe(false);
    expect(prepareConversationUploadSchema.safeParse({ ...base, workspaceId: "other" }).success).toBe(false);
  });
});
