import { describe, expect, it } from "vitest";
import { conversationAudioAccept, conversationUploadSchemaFactory, normalizeConversationMimeType } from "./conversation-upload-schema";

const messages = { fileRequired: "required", fileTooLarge: "large", unsupportedFile: "type", localeRequired: "locale" };
const mimeTypes = ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm"];

describe("conversation upload validation", () => {
  it("accepts configured audio and normalizes common browser MIME aliases", () => {
    const file = new File(["audio"], "call.m4a", { type: "audio/x-m4a" });
    expect(normalizeConversationMimeType(file, mimeTypes)).toBe("audio/mp4");
    expect(conversationUploadSchemaFactory(messages, 100, mimeTypes).safeParse({ file, locale: "es" }).success).toBe(true);
  });

  it("advertises MPEG extensions for the audio/mpeg picker entry", () => {
    expect(conversationAudioAccept(mimeTypes)["audio/mpeg"]).toContain(".mpeg");
  });

  it("uses an approved extension when the browser omits the MIME type", () => {
    for (const filename of ["call.webm", "call.weba", "call.mpeg"]) {
      const file = new File(["audio"], filename);
      expect(normalizeConversationMimeType(file, mimeTypes)).toBe(filename.endsWith("mpeg") ? "audio/mpeg" : "audio/webm");
      expect(conversationUploadSchemaFactory(messages, 100, mimeTypes).safeParse({ file, locale: "en" }).success).toBe(true);
    }
  });

  it("rejects unsupported extensions and files over the configured limit", () => {
    const schema = conversationUploadSchemaFactory(messages, 3, mimeTypes);
    expect(schema.safeParse({ file: new File(["audio"], "call.txt", { type: "text/plain" }), locale: "en" }).success).toBe(false);
    expect(schema.safeParse({ file: new File(["audio"], "call.mp3", { type: "audio/mpeg" }), locale: "en" }).success).toBe(false);
  });
});
