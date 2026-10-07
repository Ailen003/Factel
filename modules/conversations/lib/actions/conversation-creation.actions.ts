"use server";

import {
  conversationCreationQuerySchema, prepareConversationCreationSchema,
  confirmConversationCreationSchema, abandonConversationCreationSchema,
} from "../types/conversation-creation.types";
import {
  getConversationCreationState, prepareConversationCreation,
  confirmConversationCreation, abandonConversationCreation,
} from "@/lib/records/conversation-record-plan.services";

const invalid = () => ({ success: false as const, error: { code: "VALIDATION_ERROR", message: "VALIDATION_ERROR" } });

export async function getConversationCreationStateAction(input: unknown) {
  const parsed = conversationCreationQuerySchema.safeParse(input);
  return parsed.success ? getConversationCreationState(parsed.data) : invalid();
}
export async function prepareConversationCreationAction(input: unknown) {
  const parsed = prepareConversationCreationSchema.safeParse(input);
  return parsed.success ? prepareConversationCreation(parsed.data) : invalid();
}
export async function confirmConversationCreationAction(input: unknown) {
  const parsed = confirmConversationCreationSchema.safeParse(input);
  return parsed.success ? confirmConversationCreation(parsed.data) : invalid();
}
export async function abandonConversationCreationAction(input: unknown) {
  const parsed = abandonConversationCreationSchema.safeParse(input);
  return parsed.success ? abandonConversationCreation(parsed.data) : invalid();
}
