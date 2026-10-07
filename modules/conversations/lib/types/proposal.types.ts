import { z } from "zod";
import { conversationIdSchema } from "./conversation.types";
import { SERVICE_TYPES, REQUEST_PRIORITIES } from "@/modules/requests/form/create/schemas/create-service-request-schema";

export const clientFieldKeys = ["name", "email", "phone", "company", "address", "notes"] as const;
export const requestFieldKeys = ["title", "description", "serviceType", "priority", "preferredSchedule", "serviceAddress", "nextSteps"] as const;
export type ClientFieldKey = typeof clientFieldKeys[number];
export type RequestFieldKey = typeof requestFieldKeys[number];
export type ProposalFieldKey = ClientFieldKey | RequestFieldKey;
const text = (maximum: number) => z.string().max(maximum);
export const clientDraftSchema = z.object({
  name: text(201), email: text(320), phone: text(64), company: text(201), address: text(1000), notes: text(4000),
}).strict();
export const requestDraftSchema = z.object({
  stableItemId: conversationIdSchema,
  title: text(201), description: text(4000), serviceType: z.union([z.enum(SERVICE_TYPES), z.literal("")]),
  priority: z.union([z.enum(REQUEST_PRIORITIES), z.literal("")]),
  preferredSchedule: text(1000), serviceAddress: text(1000), nextSteps: text(4000),
}).strict();
export const proposalDraftSchema = z.object({
  client: clientDraftSchema,
  requests: z.array(requestDraftSchema).min(1).max(50),
}).strict().superRefine((draft, ctx) => {
  if (new Set(draft.requests.map((item) => item.stableItemId)).size !== draft.requests.length) {
    ctx.addIssue({ code: "custom", path: ["requests"], message: "DUPLICATE_ITEM_ID" });
  }
});
export type ProposalDraft = z.infer<typeof proposalDraftSchema>;
export type ClientDraft = ProposalDraft["client"];
export type RequestDraft = ProposalDraft["requests"][number];
export const findingCodes = ["MISSING_REQUIRED", "INVALID_FORMAT", "NONEXISTENT_EVIDENCE", "AMBIGUITY", "CONTRADICTION", "LOW_CONFIDENCE", "SENSITIVE_DATA_OMITTED"] as const;
// Up to 356 fields, plus business validation and provider semantic findings.
export const maxProposalFindings = 1024;
export function isResolvableFinding(code: typeof findingCodes[number]): boolean {
  return ["AMBIGUITY", "CONTRADICTION", "NONEXISTENT_EVIDENCE"].includes(code);
}
export function isPersistentFinding(code: typeof findingCodes[number]): boolean {
  return isResolvableFinding(code) || code === "LOW_CONFIDENCE" || code === "SENSITIVE_DATA_OMITTED";
}
export interface ProposalField {
  target: "client" | "request";
  itemId: string | null;
  fieldKey: ProposalFieldKey;
  observedValue: string | null;
  normalizedValue: string | null;
  provenance: "extracted" | "manual" | "default";
  evidenceIds: string[];
  confidence: number | null;
}
export interface ProposalFinding {
  id: string;
  code: typeof findingCodes[number];
  severity: "blocking" | "warning" | "info";
  target: "client" | "request" | "conversation";
  itemId: string | null;
  fieldKey: ProposalFieldKey | null;
  resolution: string | null;
}
/** Application-owned validated output; never an unchecked provider response. */
export interface ValidatedExtraction {
  draft: ProposalDraft;
  fields: ProposalField[];
  findings: ProposalFinding[];
  versions: { schema: string; task: string; prompt: string; policy: string };
}
export interface ProposalRevisionView {
  id: string;
  revisionNumber: number;
  parentRevisionId: string | null;
  authorKind: "extraction" | "human";
  authorName: string | null;
  createdAt: string;
  readyAt: string | null;
  readyByName: string | null;
  draft: ProposalDraft;
  fields: ProposalField[];
  findings: ProposalFinding[];
  canMarkReady: boolean;
}
export interface ConversationReview {
  conversationId: string;
  version: number;
  status: string;
  currentRevisionId: string | null;
  revision: ProposalRevisionView | null;
  candidate?: ProposalRevisionView | null;
}
export interface ProposalHistory {
  revisions: Array<Pick<ProposalRevisionView, "id" | "revisionNumber" | "authorKind" | "authorName" | "createdAt" | "readyAt">>;
  nextCursor: string | null;
}
export const reviewQuerySchema = z.object({ conversationId: conversationIdSchema, revisionId: conversationIdSchema.optional() }).strict();
export const historyQuerySchema = z.object({ conversationId: conversationIdSchema, cursor: conversationIdSchema.optional() }).strict();
export const saveProposalRevisionSchema = z.object({
  conversationId: conversationIdSchema,
  expectedVersion: z.number().int().positive(),
  baseRevisionId: conversationIdSchema,
  operationId: z.string().uuid(),
  draft: proposalDraftSchema,
  resolutions: z.array(z.object({ findingId: conversationIdSchema, reason: z.string().trim().min(1).max(1000) }).strict()).max(maxProposalFindings),
}).strict();
export const markProposalReadySchema = z.object({
  conversationId: conversationIdSchema, expectedVersion: z.number().int().positive(), revisionId: conversationIdSchema,
}).strict();
export type SaveProposalRevisionInput = z.infer<typeof saveProposalRevisionSchema>;
export type MarkProposalReadyInput = z.infer<typeof markProposalReadySchema>;
export const resolveReprocessingCandidateSchema = z.object({
  conversationId: conversationIdSchema,
  expectedVersion: z.number().int().positive(),
  baseRevisionId: conversationIdSchema,
  candidateRevisionId: conversationIdSchema,
  operationId: z.string().uuid(),
  keepPrevious: z.boolean(),
  clientFields: z.array(z.enum(clientFieldKeys)).max(clientFieldKeys.length),
  requests: z.array(z.object({
    candidateItemId: conversationIdSchema,
    targetItemId: conversationIdSchema.nullable(),
    fields: z.array(z.enum(requestFieldKeys)).min(1).max(requestFieldKeys.length),
  }).strict()).max(50),
  removeRequestIds: z.array(conversationIdSchema).max(50),
}).strict();
export type ResolveReprocessingCandidateInput = z.infer<typeof resolveReprocessingCandidateSchema>;
export function emptyRequestDraft(stableItemId: string): RequestDraft {
  return { stableItemId, title: "", description: "", serviceType: "", priority: "normal", preferredSchedule: "", serviceAddress: "", nextSteps: "" };
}
