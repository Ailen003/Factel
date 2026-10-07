"use server";

import { continueConversationExtractionSchema } from "../types/conversation.types";
import { continueConversationExtraction } from "../services/processing.services";

export async function continueConversationExtractionAction(input: unknown) {
  const parsed = continueConversationExtractionSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: { code: "VALIDATION_ERROR", message: "VALIDATION_ERROR" } };
  return continueConversationExtraction(parsed.data);
}
