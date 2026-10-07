import "server-only";

import { randomUUID } from "node:crypto";
import { generateText, Output, APICallError } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";
import {
  clientFieldKeys, requestFieldKeys, emptyRequestDraft,
  type ProposalField, type ProposalFinding, type ValidatedExtraction,
} from "@/modules/conversations/lib/types/proposal.types";
import { ProposalValidationError, validateExtraction, isRepresentableProposalValue, findingFor } from "@/modules/conversations/lib/validation/proposal-validation";
import { ExtractionError, extractionPrompt, extractionVersions, getExtractionProfile } from "./extraction-profile";

const valueSchema = z.object({
  value: z.string().max(4000), observed: z.string().max(4000).nullable(),
  evidenceIds: z.array(z.string().max(128)).max(20), confidence: z.number().min(0).max(1).nullable(),
  sensitive: z.boolean(),
}).strict();
export const extractionOutputSchema = z.object({
  client: z.object({ name: valueSchema, email: valueSchema, phone: valueSchema, company: valueSchema, address: valueSchema, notes: valueSchema }).strict(),
  requests: z.array(z.object({ title: valueSchema, description: valueSchema, serviceType: valueSchema, priority: valueSchema, preferredSchedule: valueSchema, serviceAddress: valueSchema, nextSteps: valueSchema }).strict()).max(50),
  findings: z.array(z.object({
    code: z.enum(["AMBIGUITY", "CONTRADICTION", "LOW_CONFIDENCE"]),
    target: z.enum(["client", "request", "conversation"]),
    requestIndex: z.number().int().min(0).max(49).nullable(),
    fieldKey: z.enum([...clientFieldKeys, ...requestFieldKeys]).nullable(),
  }).strict()).max(100),
}).strict();
type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
export interface ExtractionInput {
  language: string;
  evidence: Array<{ id: string; text: string }>;
}

export function normalizeExtractionOutput(raw: ExtractionOutput, evidence: ExtractionInput["evidence"]): ValidatedExtraction {
  const output = extractionOutputSchema.parse(raw);
  const draft: ValidatedExtraction["draft"] = {
    client: { name: "", email: "", phone: "", company: "", address: "", notes: "" },
    requests: output.requests.map(() => emptyRequestDraft(randomUUID())),
  };
  if (!draft.requests.length) draft.requests.push(emptyRequestDraft(randomUUID()));
  const fields: ProposalField[] = [];
  const findings: ProposalFinding[] = [];
  function mapField(target: "client" | "request", itemId: string | null, fieldKey: ProposalField["fieldKey"], value: z.infer<typeof valueSchema>) {
    if (value.sensitive) {
      findings.push({ id: randomUUID(), code: "SENSITIVE_DATA_OMITTED", severity: "warning", target, itemId, fieldKey, resolution: null });
      return "";
    }
    if (!isRepresentableProposalValue(target, fieldKey, value.value)) {
      findings.push(findingFor("NONEXISTENT_EVIDENCE", target, itemId, fieldKey));
      return "";
    }
    if (!value.value && !value.observed && !value.evidenceIds.length) return "";
    fields.push({ target, itemId, fieldKey, observedValue: value.observed, normalizedValue: value.value, provenance: "extracted", evidenceIds: value.evidenceIds, confidence: value.confidence });
    return value.value;
  }
  for (const key of clientFieldKeys) draft.client[key] = mapField("client", null, key, output.client[key]);
  output.requests.forEach((request, index) => {
    const item = draft.requests[index];
    for (const key of requestFieldKeys) {
      const value = mapField("request", item.stableItemId, key, request[key]);
      // Catalog and length validation is performed by the shared authoritative validator.
      Object.assign(item, { [key]: value });
    }
  });
  for (const item of draft.requests) {
    if (!item.priority) item.priority = "normal";
    if (!fields.some((field) => field.itemId === item.stableItemId && field.fieldKey === "priority")) {
      fields.push({ target: "request", itemId: item.stableItemId, fieldKey: "priority", observedValue: null, normalizedValue: "normal", provenance: "default", evidenceIds: [], confidence: null });
    }
  }
  for (const finding of output.findings) {
    if (finding.target === "request" && (finding.requestIndex === null || !output.requests[finding.requestIndex])) throw new ExtractionError("EXTRACTION_INVALID_RESPONSE");
    findings.push({ id: randomUUID(), code: finding.code, severity: finding.code === "LOW_CONFIDENCE" ? "warning" : "blocking", target: finding.target, itemId: finding.target === "request" ? draft.requests[finding.requestIndex!].stableItemId : null, fieldKey: finding.fieldKey, resolution: null });
  }
  return validateExtraction({ draft, fields, findings, versions: extractionVersions }, evidence);
}

export async function extractConversation(input: ExtractionInput) {
  const profile = getExtractionProfile();
  const prompt = JSON.stringify(input);
  if (!input.evidence.length || prompt.length > profile.maxInputCharacters) throw new ExtractionError("EXTRACTION_INPUT_LIMIT");
  const started = Date.now();
  try {
    const result = await generateText({
      model: createGroq({ apiKey: profile.apiKey })(profile.model),
      system: extractionPrompt,
      prompt,
      output: Output.object({ schema: extractionOutputSchema, name: "conversation_extraction" }),
      providerOptions: { groq: { structuredOutputs: true, strictJsonSchema: true } },
      maxOutputTokens: profile.maxOutputTokens,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(profile.timeoutMs),
      experimental_telemetry: { isEnabled: false },
    });
    if (result.finishReason !== "stop") throw new ExtractionError("EXTRACTION_INVALID_RESPONSE");
    return {
      extraction: normalizeExtractionOutput(result.output, input.evidence),
      latencyMs: Date.now() - started,
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 },
    };
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    let providerCode: string | undefined;
    if (APICallError.isInstance(error) && error.responseBody) {
      try {
        const code: unknown = JSON.parse(error.responseBody)?.error?.code;
        if (typeof code === "string" && ["json_validate_failed", "model_not_found", "model_decommissioned", "rate_limit_exceeded", "invalid_api_key", "invalid_request_error"].includes(code)) providerCode = code;
      } catch { /* Provider bodies are never logged. */ }
    }
    console.error("Extraction provider failure", { name: error instanceof Error ? error.name : "UnknownError",
      status: APICallError.isInstance(error) ? error.statusCode : undefined,
      providerCode,
      validationCode: error instanceof ProposalValidationError ? error.code : undefined,
      fieldKey: error instanceof ProposalValidationError ? error.fieldKey : undefined,
      rule: error instanceof ProposalValidationError ? error.rule : undefined });
    if (APICallError.isInstance(error) && [401, 403].includes(error.statusCode ?? 0)) throw new ExtractionError("EXTRACTION_ACCESS_DENIED");
    // An explicit generation rejection delivered no usable output. The durable
    // workflow owns the bounded retry and keeps the same run/reservation. Do not
    // retry arbitrary 400s, local validation failures or uncertain submissions.
    if (APICallError.isInstance(error) && error.statusCode === 400 && providerCode === "json_validate_failed") {
      throw new ExtractionError("EXTRACTION_INVALID_RESPONSE", true);
    }
    if (APICallError.isInstance(error) && (error.statusCode === 429 || (error.statusCode ?? 0) >= 500)) throw new ExtractionError("EXTRACTION_PROVIDER_UNAVAILABLE", true);
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new ExtractionError("EXTRACTION_PROVIDER_TIMEOUT", false);
    throw new ExtractionError("EXTRACTION_INVALID_RESPONSE");
  }
}
