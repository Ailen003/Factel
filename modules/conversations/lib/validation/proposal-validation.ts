import { z } from "zod";
import { createClientSchema, normalizeInternationalPhone } from "@/modules/clients/form/create/schemas/create-client-schema";
import { createServiceRequestSchema } from "@/modules/requests/form/create/schemas/create-service-request-schema";
import { hasExcludedSensitiveValues } from "@/lib/records/sensitive-submission-policy";
import { normalizeSpokenPhone } from "./spoken-phone";
import {
  clientFieldKeys, requestFieldKeys, proposalDraftSchema, findingCodes, clientDraftSchema, requestDraftSchema,
  isResolvableFinding, isPersistentFinding, maxProposalFindings,
  type ProposalDraft, type ProposalField, type ProposalFieldKey, type ProposalFinding, type ValidatedExtraction,
} from "../types/proposal.types";

export class ProposalValidationError extends Error {
  constructor(readonly code: string, readonly fieldKey?: ProposalFieldKey, readonly rule?: "quote" | "contact" | "missingEvidence") { super(code); this.name = "ProposalValidationError"; }
}
export function fieldIdentity(target: string, itemId: string | null, fieldKey: string) {
  return `${target}:${itemId ?? "client"}:${fieldKey}`;
}
export function draftFields(draft: ProposalDraft): Array<{ target: "client" | "request"; itemId: string | null; fieldKey: ProposalFieldKey; value: string }> {
  return [
    ...clientFieldKeys.map((fieldKey) => ({ target: "client" as const, itemId: null, fieldKey, value: draft.client[fieldKey] })),
    ...draft.requests.flatMap((item) => requestFieldKeys.map((fieldKey) => ({ target: "request" as const, itemId: item.stableItemId, fieldKey, value: item[fieldKey] }))),
  ];
}
export function normalizeProposalDraft(input: ProposalDraft): ProposalDraft {
  const draft = proposalDraftSchema.parse(input);
  return {
    client: {
      name: draft.client.name.trim(), email: draft.client.email.trim().toLowerCase(),
      phone: normalizeInternationalPhone(draft.client.phone), company: draft.client.company.trim(),
      address: draft.client.address.trim(), notes: draft.client.notes.trim(),
    },
    requests: draft.requests.map((item) => ({ ...item, title: item.title.trim(), description: item.description.trim(),
      preferredSchedule: item.preferredSchedule.trim(), serviceAddress: item.serviceAddress.trim(), nextSteps: item.nextSteps.trim() })),
  };
}
export function findingFor(code: ProposalFinding["code"], target: ProposalFinding["target"], itemId: string | null, fieldKey: ProposalFieldKey | null, severity: ProposalFinding["severity"] = "blocking"): ProposalFinding {
  return { id: `${code}:${fieldIdentity(target, itemId, fieldKey ?? "all")}`, code, target, itemId, fieldKey, severity, resolution: null };
}
/** Business omissions are persisted as findings; they do not reject a reviewable draft. */
export function validateProposalDraft(draft: ProposalDraft): ProposalFinding[] {
  const findings: ProposalFinding[] = [];
  const client = createClientSchema.safeParse(draft.client);
  if (!client.success) for (const issue of client.error.issues) {
    const key = issue.path[0] as typeof clientFieldKeys[number];
    const missing = key === "email" ? !draft.client.email && !draft.client.phone : !draft.client[key];
    findings.push(findingFor(missing ? "MISSING_REQUIRED" : "INVALID_FORMAT", "client", null, key));
  }
  for (const item of draft.requests) {
    const { stableItemId, ...values } = item;
    const result = createServiceRequestSchema.safeParse({ ...values, clientId: "proposal-client" });
    if (!result.success) for (const issue of result.error.issues) {
      const key = issue.path[0] as typeof requestFieldKeys[number];
      findings.push(findingFor(item[key] ? "INVALID_FORMAT" : "MISSING_REQUIRED", "request", stableItemId, key));
    }
  }
  return Array.from(new Map(findings.map((finding) => [finding.id, finding])).values());
}
export function hasSensitiveDraft(draft: ProposalDraft): boolean {
  return hasExcludedSensitiveValues(draft.client) || draft.requests.some(({ stableItemId: _id, ...values }) => hasExcludedSensitiveValues(values));
}
export function canPrepareProposal(findings: ProposalFinding[]): boolean {
  return !findings.some((finding) => finding.severity === "blocking" && !finding.resolution);
}

/** Provider strings may exceed a field's limits or use an unsupported catalog label. */
export function isRepresentableProposalValue(target: "client" | "request", fieldKey: ProposalFieldKey, value: string): boolean {
  const shape = target === "client" ? clientDraftSchema.shape : requestDraftSchema.shape;
  const schema = (shape as Record<string, z.ZodType>)[fieldKey];
  return !!schema && schema.safeParse(value).success;
}

const fieldSchema = z.object({
  target: z.enum(["client", "request"]), itemId: z.string().nullable(),
  fieldKey: z.enum([...clientFieldKeys, ...requestFieldKeys]),
  observedValue: z.string().max(16000).nullable(), normalizedValue: z.string().max(4000).nullable(),
  provenance: z.enum(["extracted", "manual", "default"]),
  evidenceIds: z.array(z.string()).max(100), confidence: z.number().min(0).max(1).nullable(),
}).strict();
const findingSchema = z.object({
  id: z.string().max(191), code: z.enum(findingCodes), severity: z.enum(["blocking", "warning", "info"]),
  target: z.enum(["client", "request", "conversation"]), itemId: z.string().nullable(),
  fieldKey: z.enum([...clientFieldKeys, ...requestFieldKeys]).nullable(), resolution: z.string().nullable(),
}).strict();
const extractionSchema = z.object({
  draft: proposalDraftSchema, fields: z.array(fieldSchema).max(356), findings: z.array(findingSchema).max(maxProposalFindings),
  versions: z.object({ schema: z.string().min(1).max(128), task: z.string().min(1).max(128), prompt: z.string().min(1).max(128), policy: z.string().min(1).max(128) }).strict(),
}).strict();

/** Re-run at the publishing boundary using evidence loaded from the authoritative transcript. */
export function validateExtraction(input: ValidatedExtraction, evidence: Array<{ id: string; text: string }>): ValidatedExtraction {
  const parsed = extractionSchema.safeParse(input);
  if (!parsed.success) throw new ProposalValidationError("EXTRACTION_INVALID_SCHEMA");
  const extraction = parsed.data;
  const draft = normalizeProposalDraft(extraction.draft);
  draft.client.phone = normalizeSpokenPhone(extraction.draft.client.phone) ?? draft.client.phone;
  const evidenceMap = new Map(evidence.map((entry) => [entry.id, entry.text]));
  const expected = new Map(draftFields(draft).map((field) => [fieldIdentity(field.target, field.itemId, field.fieldKey), field]));
  const fields: ProposalField[] = [];
  const seen = new Set<string>();
  const omissions: ProposalFinding[] = [];
  function discardField(field: Pick<ProposalField, "target" | "itemId" | "fieldKey">) {
    const value = field.fieldKey === "priority" ? "normal" : "";
    if (field.target === "client") Object.assign(draft.client, { [field.fieldKey]: value });
    else Object.assign(draft.requests.find((item) => item.stableItemId === field.itemId)!, { [field.fieldKey]: value });
    fields.push({ ...field, observedValue: null, normalizedValue: value || null, provenance: "default", evidenceIds: [], confidence: null });
    omissions.push(findingFor("NONEXISTENT_EVIDENCE", field.target, field.itemId, field.fieldKey));
  }
  for (const field of extraction.fields) {
    const identity = fieldIdentity(field.target, field.itemId, field.fieldKey);
    const actual = expected.get(identity);
    if (!actual || seen.has(identity)) throw new ProposalValidationError("EXTRACTION_INVALID_SCHEMA");
    seen.add(identity);
    const raw = field.observedValue;
    if (hasExcludedSensitiveValues({ [field.fieldKey]: raw }) || hasExcludedSensitiveValues({ [field.fieldKey]: field.normalizedValue })) {
      omissions.push(findingFor("SENSITIVE_DATA_OMITTED", field.target, field.itemId, field.fieldKey, "warning"));
      if (field.target === "client") draft.client[field.fieldKey as typeof clientFieldKeys[number]] = "";
      else {
        const item = draft.requests.find((item) => item.stableItemId === field.itemId)!;
        Object.assign(item, { [field.fieldKey]: "" });
      }
      fields.push({ ...field, observedValue: null, normalizedValue: null, provenance: "default", evidenceIds: [], confidence: null });
      continue;
    }
    if (field.provenance === "manual") throw new ProposalValidationError("EXTRACTION_INVALID_PROVENANCE");
    if (field.provenance === "default") {
      if (raw || field.evidenceIds.length || field.confidence !== null || (actual.value && !(field.fieldKey === "priority" && actual.value === "normal"))) {
        throw new ProposalValidationError("EXTRACTION_INVALID_PROVENANCE");
      }
    } else if (!raw || !field.evidenceIds.length || field.evidenceIds.some((id) => !evidenceMap.has(id))
      || !field.evidenceIds.some((id) => evidenceMap.get(id)!.includes(raw))) {
      discardField({ target: field.target, itemId: field.itemId, fieldKey: field.fieldKey });
      continue;
    }
    let normalized = field.normalizedValue?.trim() ?? "";
    if (field.fieldKey === "email") normalized = normalized.toLowerCase();
    if (field.fieldKey === "phone") normalized = normalizeSpokenPhone(normalized) ?? normalizeInternationalPhone(normalized);
    if (actual.value !== normalized) {
      discardField({ target: field.target, itemId: field.itemId, fieldKey: field.fieldKey });
      continue;
    }
    if (field.target === "client" && ["name", "email", "phone", "company", "address"].includes(field.fieldKey) && actual.value) {
      const observed = field.fieldKey === "phone" ? normalizeSpokenPhone(raw ?? "")
        : field.fieldKey === "email" ? raw?.trim().toLowerCase() : raw?.trim();
      if (observed !== actual.value) {
        // Keep the verified quote, never the unsupported proposed contact. The same
        // policy runs again at publication, without another provider call.
        Object.assign(draft.client, { [field.fieldKey]: "" });
        normalized = "";
      }
    }
    if (field.provenance === "extracted" && !normalized) {
      omissions.push(findingFor("AMBIGUITY", field.target, field.itemId, field.fieldKey));
      fields.push({ ...field, normalizedValue: null, confidence: null, evidenceIds: [...new Set(field.evidenceIds)] });
      continue;
    }
    fields.push({ ...field, normalizedValue: normalized || null, evidenceIds: [...new Set(field.evidenceIds)] });
  }
  for (const [identity, actual] of expected) if (!seen.has(identity)) {
    if (actual.value && !(actual.fieldKey === "priority" && actual.value === "normal")) {
      discardField({ target: actual.target, itemId: actual.itemId, fieldKey: actual.fieldKey });
      continue;
    }
    fields.push({ target: actual.target, itemId: actual.itemId, fieldKey: actual.fieldKey, observedValue: null,
      normalizedValue: actual.value || null, provenance: "default", evidenceIds: [], confidence: null });
  }
  const semantic: ProposalFinding[] = [];
  for (const finding of extraction.findings) {
    if (finding.target === "conversation") {
      if (finding.itemId !== null || finding.fieldKey !== null) throw new ProposalValidationError("EXTRACTION_INVALID_SCHEMA");
    } else if (finding.fieldKey === null) {
      if (finding.target === "client" ? finding.itemId !== null : !draft.requests.some((item) => item.stableItemId === finding.itemId)) throw new ProposalValidationError("EXTRACTION_INVALID_SCHEMA");
    } else if (!expected.has(fieldIdentity(finding.target, finding.itemId, finding.fieldKey))) throw new ProposalValidationError("EXTRACTION_INVALID_SCHEMA");
    if (isPersistentFinding(finding.code)) {
      semantic.push(findingFor(finding.code, finding.target, finding.itemId, finding.fieldKey,
        isResolvableFinding(finding.code) ? "blocking" : "warning"));
    }
  }
  return { draft, fields, findings: [...new Map([...validateProposalDraft(draft), ...semantic, ...omissions].map((finding) => [finding.id, finding])).values()], versions: extraction.versions };
}
