import { describe, expect, it } from "vitest";
import { emptyRequestDraft, type ValidatedExtraction } from "../types/proposal.types";
import { canPrepareProposal, validateExtraction, validateProposalDraft } from "./proposal-validation";

function empty(): ValidatedExtraction {
  return { draft: { client: { name: "", email: "", phone: "", company: "", address: "", notes: "" }, requests: [emptyRequestDraft("request-1")] },
    fields: [], findings: [], versions: { schema: "v1", task: "v1", prompt: "v1", policy: "v1" } };
}
function contact(value: string, observed = value): ValidatedExtraction {
  const output = empty();
  output.draft.client.email = value;
  output.fields.push({ target: "client", itemId: null, fieldKey: "email", observedValue: observed,
    normalizedValue: value, provenance: "extracted", evidenceIds: ["e1"], confidence: null });
  return output;
}
describe("proposal validation boundaries", () => {
  it("requires the exact name substring even when a surrounding sentence is valid evidence", () => {
    const output = empty();
    output.draft.client.name = "Ana Pérez";
    output.fields.push({ target: "client", itemId: null, fieldKey: "name", observedValue: "Me llamo Ana Pérez.",
      normalizedValue: "Ana Pérez", provenance: "extracted", evidenceIds: ["e1"], confidence: null });
    const evidence = [{ id: "e1", text: "Me llamo Ana Pérez." }];
    expect(validateExtraction(output, evidence).draft.client.name).toBe("");
    output.fields[0].observedValue = "Ana Pérez";
    expect(validateExtraction(output, evidence).draft.client.name).toBe("Ana Pérez");
  });
  it("accepts empty review drafts but never considers them ready or gives them evidence", () => {
    const output = validateExtraction(empty(), [{ id: "e1", text: "Buenos días" }]);
    expect(canPrepareProposal(output.findings)).toBe(false);
    expect(output.fields.every((field) => field.evidenceIds.length === 0 && field.provenance === "default")).toBe(true);
    expect(output.draft.requests[0].priority).toBe("normal");
    expect(validateExtraction(output, [{ id: "e1", text: "Buenos días" }])).toEqual(output);
  });
  it("normalizes explicit email and retains immutable observed spelling", () => {
    const result = validateExtraction(contact(" ANA@Example.com ", "ANA@Example.com"), [{ id: "e1", text: "Mi email es ANA@Example.com" }]);
    expect(result.draft.client.email).toBe("ana@example.com");
    expect(result.fields[0].observedValue).toBe("ANA@Example.com");
  });
  it("omits unsupported contacts with valid quotes but still rejects fabricated quotes", () => {
    const evidence = [{ id: "e1", text: "No tengo email" }];
    const result = validateExtraction(contact("invented@example.com", "No tengo email"), evidence);
    expect(result.draft.client.email).toBe("");
    expect(JSON.stringify(result)).not.toContain("invented@example.com");
    expect(result.fields[0]).toMatchObject({ observedValue: "No tengo email", normalizedValue: null, provenance: "extracted", evidenceIds: ["e1"] });
    expect(result.findings).toContainEqual(expect.objectContaining({ code: "AMBIGUITY", fieldKey: "email", severity: "blocking", resolution: null }));
    expect(validateExtraction(result, evidence)).toEqual(result);
    const discarded = validateExtraction(contact("ana@example.com"), [{ id: "e1", text: "another@example.com" }]);
    expect(discarded.draft.client.email).toBe("");
    expect(discarded.fields[0]).toMatchObject({ observedValue: null, evidenceIds: [], provenance: "default" });
  });
  it("rejects unrelated evidence identifiers, unsupported fields and fake provenance", () => {
    const discarded = validateExtraction(contact("ana@example.com"), [{ id: "other-transcript", text: "ana@example.com" }]);
    expect(discarded.fields[0]).toMatchObject({ normalizedValue: null, observedValue: null, evidenceIds: [] });
    expect(discarded.findings).toContainEqual(expect.objectContaining({ code: "NONEXISTENT_EVIDENCE", severity: "blocking" }));
    const output = contact("ana@example.com");
    output.fields[0].provenance = "manual";
    expect(() => validateExtraction(output, [{ id: "e1", text: "ana@example.com" }])).toThrow("EXTRACTION_INVALID_PROVENANCE");
    expect(() => validateExtraction({ ...empty(), draft: { ...empty().draft, budget: 500 } } as ValidatedExtraction, [])).toThrow("EXTRACTION_INVALID_SCHEMA");
  });
  it("retains local phone as an actionable invalid-format finding without adding a country", () => {
    const output = empty();
    output.draft.client.phone = "555-0123";
    output.fields.push({ target: "client", itemId: null, fieldKey: "phone", observedValue: "555-0123", normalizedValue: "555-0123",
      provenance: "extracted", evidenceIds: ["e1"], confidence: 0.99 });
    const result = validateExtraction(output, [{ id: "e1", text: "Call 555-0123" }]);
    expect(result.draft.client.phone).toBe("5550123");
    expect(result.findings).toContainEqual(expect.objectContaining({ code: "INVALID_FORMAT", fieldKey: "phone", severity: "blocking" }));
  });
  it.each([
    ["plus one, 4-1-5, 5-5-5, 0-1-8-2", "+14155550182"],
    ["más cinco tres cinco dos uno cero cuatro seis siete ocho", "+5352104678"],
  ])("accepts an explicit spoken phone without modifying its evidence: %s", (observed, normalized) => {
    const output = empty();
    output.draft.client.phone = normalized;
    output.fields.push({ target: "client", itemId: null, fieldKey: "phone", observedValue: observed,
      normalizedValue: normalized, provenance: "extracted", evidenceIds: ["e1"], confidence: 0.9 });
    const evidence = [{ id: "e1", text: `Phone: ${observed}` }];
    const result = validateExtraction(output, evidence);
    expect(result.draft.client.phone).toBe(normalized);
    expect(result.fields[0].observedValue).toBe(observed);
    expect(result.findings.some((finding) => finding.fieldKey === "phone")).toBe(false);
    expect(validateExtraction(result, evidence)).toEqual(result);
  });
  it.each([
    ["415-555-0182", "+14155550182"],
    ["plus one 415-555-0182", "+14155550183"],
    ["plus one double four five", "+1445"],
    ["My phone is +14155550182", "+14155550182"],
    ["plus one 415-555-0182", ""],
  ])("keeps other data but blocks readiness for an unsupported phone: %s -> %s", (observed, proposed) => {
    const output = contact("sarah.mitchell82@gmail.com");
    output.draft.requests[0].title = "Repair kitchen faucet";
    output.fields.push({ target: "request", itemId: "request-1", fieldKey: "title", observedValue: "Repair kitchen faucet",
      normalizedValue: "Repair kitchen faucet", provenance: "extracted", evidenceIds: ["e3"], confidence: null });
    output.draft.client.phone = proposed;
    output.fields.push({ target: "client", itemId: null, fieldKey: "phone", observedValue: observed,
      normalizedValue: proposed || null, provenance: "extracted", evidenceIds: ["e2"], confidence: 0.99 });
    const evidence = [{ id: "e1", text: "sarah.mitchell82@gmail.com" }, { id: "e2", text: observed }, { id: "e3", text: "Repair kitchen faucet" }];
    const result = validateExtraction(output, evidence);
    expect(result.draft.client.phone).toBe("");
    expect(result.draft.client.email).toBe("sarah.mitchell82@gmail.com");
    expect(result.draft.requests[0].title).toBe("Repair kitchen faucet");
    expect(result.fields.find((field) => field.fieldKey === "phone")).toMatchObject({ observedValue: observed, normalizedValue: null, evidenceIds: ["e2"], confidence: null });
    const finding = result.findings.find((finding) => finding.fieldKey === "phone");
    expect(finding).toMatchObject({ code: "AMBIGUITY", severity: "blocking", resolution: null });
    expect(canPrepareProposal([finding!])).toBe(false);
    expect(validateExtraction(result, evidence)).toEqual(result);
  });
  it("removes sensitive observed and normalized content and remains idempotently valid", () => {
    const output = empty();
    output.draft.client.notes = "password: secret-test";
    output.fields.push({ target: "client", itemId: null, fieldKey: "notes", observedValue: "password: secret-test", normalizedValue: "password: secret-test",
      provenance: "extracted", evidenceIds: ["e1"], confidence: null });
    const evidence = [{ id: "e1", text: "password: secret-test" }];
    const result = validateExtraction(output, evidence);
    expect(JSON.stringify(result)).not.toContain("secret-test");
    expect(result.findings).toContainEqual(expect.objectContaining({ code: "SENSITIVE_DATA_OMITTED" }));
    expect(validateExtraction(result, evidence)).toEqual(result);
  });
  it("forces semantic conflicts to blocking regardless of model severity or resolution", () => {
    const output = empty();
    output.findings.push({ id: "f1", code: "CONTRADICTION", severity: "info", target: "conversation", itemId: null, fieldKey: null, resolution: "The model says resolved" });
    const result = validateExtraction(output, []);
    expect(result.findings).toContainEqual(expect.objectContaining({ code: "CONTRADICTION", severity: "blocking", resolution: null }));
  });
  it("uses manual business rules without requiring an existing client ID for request drafts", () => {
    const draft = empty().draft;
    draft.client = { ...draft.client, name: "Ana", email: "ana@example.com" };
    draft.requests[0] = { ...draft.requests[0], title: "Repair", description: "Repair the heater", serviceType: "repair" };
    expect(validateProposalDraft(draft)).toEqual([]);
    draft.client.phone = "local-only";
    expect(canPrepareProposal(validateProposalDraft(draft))).toBe(false);
  });
});
