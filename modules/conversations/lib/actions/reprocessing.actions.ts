"use server";

import { startConversationProcessingSchema } from "../types/conversation.types";
import { resolveReprocessingCandidateSchema } from "../types/proposal.types";
import { startConversationReprocessing } from "../services/processing.services";
import { resolveReprocessingCandidate } from "../services/proposal.services";

export async function startConversationReprocessingAction(input: unknown) {
  const parsed = startConversationProcessingSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: { code: "VALIDATION_ERROR", message: "VALIDATION_ERROR" } };
  return startConversationReprocessing(parsed.data);
}

export async function resolveReprocessingCandidateAction(input: unknown) {
  const parsed = resolveReprocessingCandidateSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: { code: "VALIDATION_ERROR", message: "VALIDATION_ERROR" } };
  return resolveReprocessingCandidate(parsed.data);
}
