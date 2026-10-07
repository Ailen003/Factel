import { describe, expect, it } from "vitest";
import { conversationRecordingSchemaFactory } from "./conversation-recording-schema";

const schema = conversationRecordingSchemaFactory({
  consentRequired: "consent required",
  localeRequired: "locale required",
});

describe("conversation recording schema", () => {
  it("requires explicit consent for every recording", () => {
    expect(schema.safeParse({ consent: false, locale: "es" })).toMatchObject({ success: false });
    expect(schema.safeParse({ consent: true, locale: "es" })).toEqual({
      success: true,
      data: { consent: true, locale: "es" },
    });
  });

  it("accepts only supported conversation languages", () => {
    expect(schema.safeParse({ consent: true, locale: "fr" })).toMatchObject({ success: false });
  });
});
