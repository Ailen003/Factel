import { describe, expect, it } from "vitest";
import { clientFieldKeys, requestFieldKeys, emptyRequestDraft, type ProposalField, type ValidatedExtraction } from "../types/proposal.types";
import { canPrepareProposal, validateExtraction } from "./proposal-validation";

function fixture(): ValidatedExtraction {
  return { draft: { client: { name: "", email: "", phone: "", company: "", address: "", notes: "" },
    requests: [emptyRequestDraft("item-1"), { ...emptyRequestDraft("item-2"), title: "Second job" }] },
    fields: [{ target: "request", itemId: "item-2", fieldKey: "title", observedValue: "Second job", normalizedValue: "Second job", provenance: "extracted", evidenceIds: ["e2"], confidence: null }],
    findings: [], versions: { schema: "v1", task: "v1", prompt: "v4", policy: "v3" } };
}
const evidence = [{ id: "e1", text: "fix the kitchen faucet leak" }, { id: "e2", text: "Second job" }];
const cases = [
  ...clientFieldKeys.map((fieldKey) => ({ target: "client" as const, itemId: null, fieldKey })),
  ...requestFieldKeys.map((fieldKey) => ({ target: "request" as const, itemId: "item-1", fieldKey })),
];
describe("field-local recovery", () => {
  it.each(cases)("discards only an unverified $target.$fieldKey and remains idempotent", (identity) => {
    const input = fixture();
    const value = identity.fieldKey === "serviceType" ? "repair" : identity.fieldKey === "priority" ? "high" : "proposed";
    Object.assign(identity.target === "client" ? input.draft.client : input.draft.requests[0], { [identity.fieldKey]: value });
    input.fields.push({ ...identity, normalizedValue: value, observedValue: "fabricated quote", provenance: "extracted", evidenceIds: ["e1"], confidence: 1 });
    const before = JSON.stringify(input);
    const result = validateExtraction(input, evidence);
    expect(result.fields.find((field) => field.target === identity.target && field.itemId === identity.itemId && field.fieldKey === identity.fieldKey))
      .toMatchObject({ normalizedValue: identity.fieldKey === "priority" ? "normal" : null, observedValue: null, provenance: "default", evidenceIds: [], confidence: null });
    expect(result.draft.requests[1].title).toBe("Second job");
    expect(result.draft.requests.map((item) => item.stableItemId)).toEqual(["item-1", "item-2"]);
    expect(result.findings).toContainEqual(expect.objectContaining({ ...identity, code: "NONEXISTENT_EVIDENCE", severity: "blocking", resolution: null }));
    expect(JSON.stringify(result)).not.toContain("fabricated quote");
    expect(canPrepareProposal(result.findings)).toBe(false);
    expect(validateExtraction(result, evidence)).toEqual(result);
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each([
    { observedValue: null, evidenceIds: ["e1"] },
    { observedValue: "fix the kitchen faucet leak", evidenceIds: [] },
    { observedValue: "fix the kitchen faucet leak", evidenceIds: ["foreign"] },
    { observedValue: "fix the kitchen faucet leak", evidenceIds: ["e1", "foreign"] },
    { observedValue: "Fix the kitchen faucet leak", evidenceIds: ["e1"] },
    { observedValue: "fix the kitchen faucet leak", evidenceIds: ["e1"], normalizedValue: "inspection" },
  ])("recovers bad quote/reference/value alignment without publishing false evidence: %j", (override) => {
    const input = fixture();
    input.draft.requests[0].serviceType = "repair";
    input.fields.push({ target: "request", itemId: "item-1", fieldKey: "serviceType", normalizedValue: "repair",
      provenance: "extracted", confidence: null, ...override });
    const result = validateExtraction(input, evidence);
    expect(result.draft.requests[0].serviceType).toBe("");
    expect(result.fields.filter((field) => field.fieldKey === "serviceType").every((field) => field.evidenceIds.length === 0)).toBe(true);
    expect(validateExtraction(result, evidence)).toEqual(result);
  });
  it("retains a catalog interpretation when its source quote is literal, not equal to the catalog label", () => {
    const input = fixture();
    input.draft.requests[0].serviceType = "repair";
    input.fields.push({ target: "request", itemId: "item-1", fieldKey: "serviceType", normalizedValue: "repair", observedValue: evidence[0].text,
      evidenceIds: ["e1"], provenance: "extracted", confidence: null });
    expect(validateExtraction(input, evidence).draft.requests[0].serviceType).toBe("repair");
  });
  it("recovers absent field metadata across the maximum request batch without exceeding finding limits", () => {
    const input = fixture();
    input.draft.requests = Array.from({ length: 50 }, (_, i) => ({ ...emptyRequestDraft(`item-${i}`), title: "Title", description: "Description",
      serviceType: "repair" as const, priority: "high" as const, preferredSchedule: "Tomorrow", serviceAddress: "Address", nextSteps: "Call" }));
    input.fields = [];
    const result = validateExtraction(input, []);
    expect(result.findings.length).toBeGreaterThan(200);
    expect(result.draft.requests).toHaveLength(50);
    expect(result.draft.requests.every((item) => item.title === "" && item.priority === "normal")).toBe(true);
    expect(validateExtraction(result, [])).toEqual(result);
  });
  it("still rejects ambiguous identities, duplicate items, malformed envelopes and forged provenance", () => {
    const input = fixture();
    input.fields.push({ ...input.fields[0] });
    expect(() => validateExtraction(input, evidence)).toThrow("EXTRACTION_INVALID_SCHEMA");
    input.fields = [{ ...input.fields[0], itemId: "unknown" }];
    expect(() => validateExtraction(input, evidence)).toThrow("EXTRACTION_INVALID_SCHEMA");
    input.fields = [{ ...fixture().fields[0], provenance: "manual" } as ProposalField];
    expect(() => validateExtraction(input, evidence)).toThrow("EXTRACTION_INVALID_PROVENANCE");
    input.draft.requests[1].stableItemId = input.draft.requests[0].stableItemId;
    expect(() => validateExtraction(input, evidence)).toThrow("EXTRACTION_INVALID_SCHEMA");
    expect(() => validateExtraction({} as ValidatedExtraction, [])).toThrow("EXTRACTION_INVALID_SCHEMA");
  });
});
