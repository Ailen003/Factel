import { describe, expect, it } from "vitest";
import { spokenContactConversation } from "./fixtures/spoken-contact-conversation";

// Explicit opt-in: bounded synthetic provider calls, no database/credits or audio upload.
describe.skipIf(process.env.GROQ_SMOKE_TEST !== "true")("Groq spoken-contact regression", () => {
  it("delivers verifiable data or explicit field-review gaps across repeated extractions", async () => {
    await import("dotenv/config");
    const { extractConversation } = await import("./conversation-extraction");
    const { validateExtraction } = await import("@/modules/conversations/lib/validation/proposal-validation");
    const repetitions = Number(process.env.GROQ_SMOKE_REPETITIONS ?? "1");
    expect(Number.isInteger(repetitions) && repetitions >= 1 && repetitions <= 3).toBe(true);
    for (let attempt = 0; attempt < repetitions; attempt++) {
      const { extraction } = await extractConversation(spokenContactConversation);
      for (const [key, expected] of Object.entries({ name: "Sarah Mitchell", phone: "+14155550182", email: "sarah.mitchell82@gmail.com" })) {
        const fieldKey = key as "name" | "phone" | "email";
        const actual = extraction.draft.client[fieldKey];
        if (actual) expect(actual).toBe(expected);
        else expect(extraction.findings).toContainEqual(expect.objectContaining({ target: "client", fieldKey, severity: "blocking", resolution: null }));
      }
      expect(extraction.draft.requests).toHaveLength(2);
      expect(extraction.draft.requests.some((item) => item.title || item.description)).toBe(true);
      for (const field of extraction.fields.filter((entry) => entry.provenance === "extracted")) {
        expect(spokenContactConversation.evidence.some((span) => field.evidenceIds.includes(span.id) && span.text.includes(field.observedValue!))).toBe(true);
      }
      expect(validateExtraction(extraction, spokenContactConversation.evidence)).toEqual(extraction);
      console.info(`Groq recovery smoke ${attempt + 1}/${repetitions} passed: two requests, ${extraction.findings.filter((finding) => finding.code === "NONEXISTENT_EVIDENCE").length} discarded fields, all retained evidence verified.`);
      if (attempt + 1 < repetitions) await new Promise((resolve) => setTimeout(resolve, 60000));
    }
  }, 420000);
});
