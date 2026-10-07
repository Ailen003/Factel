import { z } from "zod";
import { conversationIdSchema } from "./conversation.types";
import type { ClientCreationDraft, ClientDuplicateCandidate } from "@/modules/clients/lib/types/client.types";
import type { ServiceRequestDraft } from "@/modules/requests/lib/types/service-request.types";

export const conversationCreationQuerySchema = z.object({ conversationId: conversationIdSchema }).strict();
export const conversationClientChoiceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("new") }).strict(),
  z.object({ kind: z.literal("existing"), clientId: conversationIdSchema }).strict(),
]);
export const prepareConversationCreationSchema = z.object({
  conversationId: conversationIdSchema, revisionId: conversationIdSchema,
  expectedVersion: z.number().int().positive(), choice: conversationClientChoiceSchema,
}).strict();
export const confirmConversationCreationSchema = z.object({
  planId: conversationIdSchema, planHash: z.string().regex(/^[a-f0-9]{64}$/),
  acknowledgeDuplicates: z.boolean(),
}).strict();
export const abandonConversationCreationSchema = z.object({
  conversationId: conversationIdSchema, expectedVersion: z.number().int().positive(),
}).strict();
export type ConversationClientChoice = z.infer<typeof conversationClientChoiceSchema>;
export type PrepareConversationCreationInput = z.infer<typeof prepareConversationCreationSchema>;
export type ConfirmConversationCreationInput = z.infer<typeof confirmConversationCreationSchema>;
export type AbandonConversationCreationInput = z.infer<typeof abandonConversationCreationSchema>;
export interface ConversationCreationPreview {
  planId: string; planHash: string; expiresAt: string;
  conversationId: string; revisionId: string; version: number;
  choice: ConversationClientChoice;
  client: ClientCreationDraft;
  duplicates: ClientDuplicateCandidate[];
  requests: Array<ServiceRequestDraft & { stableItemId: string; status: "pending" }>;
}
export interface ConversationCreationResult {
  operationId: string; conversationId: string; clientId: string | null;
  requestIds: string[]; completedAt: string; replayed: boolean;
}
export interface ConversationCreationState {
  conversationId: string; version: number; revisionId: string | null;
  status: string; duplicates: ClientDuplicateCandidate[];
  preview: ConversationCreationPreview | null;
  result: ConversationCreationResult | null;
}
