// Opt-in real-provider check. Synthetic evidence only; no application database writes.
import { describe, expect, it } from "vitest";

describe.skipIf(process.env.GROQ_SMOKE_TEST !== "true")("Groq bilingual provider smoke", () => {
  it("extracts two grounded requests in Spanish and English without inventing missing contacts", async () => {
    await import("dotenv/config");
    const { extractConversation } = await import("./conversation-extraction");
    const samples = [
      { language: "es", evidence: [
        { id: "e1", text: "Me llamo Ana Pérez. Mi correo es ana@example.com." },
        { id: "e2", text: "Necesito reparar el aire acondicionado porque no enfría. Es urgente." },
        { id: "e3", text: "También necesito una inspección de la instalación eléctrica. Puedo el martes por la tarde." },
      ], email: "ana@example.com" },
      { language: "en", evidence: [
        { id: "e1", text: "My name is Alex Morgan. I am not providing a phone number or email today." },
        { id: "e2", text: "Please repair my leaking kitchen tap." },
        { id: "e3", text: "I also need maintenance for the air conditioner. Friday afternoon is convenient." },
      ], email: "" },
    ];
    const selected = process.env.GROQ_SMOKE_LOCALE ? samples.filter((sample) => sample.language === process.env.GROQ_SMOKE_LOCALE) : samples;
    expect(selected.length).toBeGreaterThan(0);
    for (const sample of selected) {
      const { extraction } = await extractConversation(sample);
      expect(extraction.draft.requests).toHaveLength(2);
      expect(extraction.draft.client.email).toBe(sample.email);
      expect(extraction.draft.client.phone).toBe("");
      for (const field of extraction.fields.filter((entry) => entry.provenance === "extracted")) {
        expect(field.evidenceIds.length).toBeGreaterThan(0);
        expect(sample.evidence.some((span) => field.evidenceIds.includes(span.id) && span.text.includes(field.observedValue!))).toBe(true);
      }
      if (!sample.email) expect(extraction.findings).toContainEqual(expect.objectContaining({ code: "MISSING_REQUIRED", target: "client", fieldKey: "email" }));
      console.info(`Groq smoke passed: ${sample.language}, two grounded requests, contact policy verified.`);
      // Pace opt-in live calls to respect the development provider's minute limits.
      if (selected.length > 1 && sample.language === "es") await new Promise((resolve) => setTimeout(resolve, 60000));
    }
  }, 240000);
});
