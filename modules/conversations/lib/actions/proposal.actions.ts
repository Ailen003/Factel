"use server";

import { recordFailure } from "@/lib/records/record-policy";
import { getConversationReview, getProposalHistory, saveProposalRevision, markProposalReady } from "../services/proposal.services";
import { reviewQuerySchema, historyQuerySchema, saveProposalRevisionSchema, markProposalReadySchema,
  type SaveProposalRevisionInput, type MarkProposalReadyInput } from "../types/proposal.types";

export async function getConversationReviewAction(input: { conversationId: string; revisionId?: string }) {
  const parsed = reviewQuerySchema.safeParse(input);
  return parsed.success ? getConversationReview(parsed.data) : recordFailure("VALIDATION_ERROR");
}
export async function getProposalHistoryAction(input: { conversationId: string; cursor?: string }) {
  const parsed = historyQuerySchema.safeParse(input);
  return parsed.success ? getProposalHistory(parsed.data) : recordFailure("VALIDATION_ERROR");
}
export async function saveProposalRevisionAction(input: SaveProposalRevisionInput) {
  const parsed = saveProposalRevisionSchema.safeParse(input);
  return parsed.success ? saveProposalRevision(parsed.data) : recordFailure("VALIDATION_ERROR");
}
export async function markProposalReadyAction(input: MarkProposalReadyInput) {
  const parsed = markProposalReadySchema.safeParse(input);
  return parsed.success ? markProposalReady(parsed.data) : recordFailure("VALIDATION_ERROR");
}
