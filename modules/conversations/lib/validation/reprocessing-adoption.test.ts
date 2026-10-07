import { describe, expect, it } from "vitest";
import { adoptReprocessingSelection } from "./reprocessing-adoption";
import { draftFields } from "./proposal-validation";
import { requestFieldKeys, type ProposalRevisionView, type ResolveReprocessingCandidateInput } from "../types/proposal.types";

function revision(id: string): ProposalRevisionView {
  const draft = { client: { name: id, email: "ada@example.com", phone: "+14155550182", company: "", address: "", notes: "" },
    requests: [{ stableItemId: `${id}-item`, title: id, description: "Repair pump", serviceType: "repair" as const,
      priority: "normal" as const, preferredSchedule: "", serviceAddress: "", nextSteps: "" }] };
  return { id, revisionNumber: 1, parentRevisionId: null, authorKind: "human", authorName: "Ada", createdAt: "2026-09-08",
    readyAt: null, readyByName: null, canMarkReady: true, draft, findings: [], fields: draftFields(draft).map((field) => ({
      target: field.target, itemId: field.itemId, fieldKey: field.fieldKey, normalizedValue: field.value || null,
      observedValue: id === "candidate" ? field.value : null, provenance: id === "candidate" ? "extracted" : "manual",
      evidenceIds: id === "candidate" ? ["evidence-1"] : [], confidence: null })) };
}
function selection(overrides: Partial<ResolveReprocessingCandidateInput> = {}): ResolveReprocessingCandidateInput {
  return { conversationId: "conversation", expectedVersion: 4, baseRevisionId: "current", candidateRevisionId: "candidate",
    operationId: "3fad146e-4a85-4713-8a10-143ba8f9f1be", keepPrevious: false, clientFields: [], requests: [], removeRequestIds: [], ...overrides };
}

describe("explicit reprocessing adoption", () => {
  it("keeps corrected values and provenance, copying only selected fields with their original evidence", () => {
    const current = revision("current"); const candidate = revision("candidate");
    candidate.draft.client.phone = "+34911234567";
    const result = adoptReprocessingSelection(current, candidate, selection({ clientFields: ["name"],
      requests: [{ candidateItemId: "candidate-item", targetItemId: "current-item", fields: ["title"] }] }), () => "new-item");
    expect(result.draft.client).toEqual({ ...current.draft.client, name: "candidate" });
    expect(result.draft.requests[0]).toEqual({ ...current.draft.requests[0], title: "candidate" });
    expect(result.fields.find((field) => field.fieldKey === "phone")).toMatchObject({ provenance: "manual", evidenceIds: [] });
    expect(result.fields.find((field) => field.fieldKey === "title")).toMatchObject({ itemId: "current-item", provenance: "extracted", evidenceIds: ["evidence-1"] });
    expect(current.draft.client.name).toBe("current");
  });
  it("adds requests with fresh identity instead of trusting extraction item IDs, and remaps blocking findings", () => {
    const candidate = revision("candidate");
    candidate.draft.requests[0].stableItemId = "current-item";
    candidate.fields = candidate.fields.map((field) => ({ ...field, itemId: field.itemId ? "current-item" : null }));
    candidate.findings = [{ id: "ambiguous", target: "request", itemId: "current-item", fieldKey: "title", code: "AMBIGUITY", severity: "blocking", resolution: null }];
    const result = adoptReprocessingSelection(revision("current"), candidate, selection({
      requests: [{ candidateItemId: "current-item", targetItemId: null, fields: [...requestFieldKeys] }] }), () => "fresh-item");
    expect(result.draft.requests.map((item) => item.stableItemId)).toEqual(["current-item", "fresh-item"]);
    expect(result.findings).toContainEqual(expect.objectContaining({ target: "request", itemId: "fresh-item", code: "AMBIGUITY", resolution: null }));
  });
  it("retains previous version completely on keep, and requires clean keep selections", () => {
    const current = revision("current");
    expect(adoptReprocessingSelection(current, revision("candidate"), selection({ keepPrevious: true }), () => "new")).toEqual({
      draft: current.draft, fields: current.fields, findings: current.findings });
    expect(() => adoptReprocessingSelection(current, revision("candidate"), selection({ keepPrevious: true, clientFields: ["name"] }), () => "new")).toThrow("VALIDATION_ERROR");
  });
  it.each([
    { removeRequestIds: ["current-item"] },
    { removeRequestIds: ["foreign-item"] },
    { clientFields: ["name", "name"] as const },
    { requests: [{ candidateItemId: "foreign-item", targetItemId: "current-item", fields: ["title"] as const }] },
    { requests: [{ candidateItemId: "candidate-item", targetItemId: "foreign-item", fields: ["title"] as const }] },
    { requests: [{ candidateItemId: "candidate-item", targetItemId: null, fields: ["title"] as const }] },
  ])("rejects invalid item selection %j", (invalid) => {
    expect(() => adoptReprocessingSelection(revision("current"), revision("candidate"),
      selection(invalid as Partial<ResolveReprocessingCandidateInput>), () => "new")).toThrow("VALIDATION_ERROR");
  });
  it("drops removed-item findings, preserves unrelated corrections and invalidates broad decisions", () => {
    const current = revision("current");
    current.findings = [{ id: "broad", target: "conversation", itemId: null, fieldKey: null, code: "CONTRADICTION", severity: "blocking", resolution: "checked" }];
    const result = adoptReprocessingSelection(current, revision("candidate"), selection({ clientFields: ["name"] }), () => "new");
    expect(result.findings).toContainEqual(expect.objectContaining({ code: "CONTRADICTION", resolution: null }));
  });
});
