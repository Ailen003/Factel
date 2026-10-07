"use server";

import {
  completeConversationUploadSchema,
  conversationFiltersSchema,
  conversationIdSchema,
  deleteConversationSchema,
  discardConversationUploadSchema,
  prepareConversationUploadSchema,
  startConversationProcessingSchema,
} from "../types/conversation.types";
import {
  completeConversationUpload,
  deleteConversation,
  discardConversationUpload,
  getConversationById,
  getConversationUploadPolicy,
  getConversations,
  prepareConversationRecording,
  prepareConversationUpload,
} from "../services/conversation.services";
import { startConversationProcessing } from "../services/processing.services";

const invalid = () => ({
  success: false as const,
  error: { code: "VALIDATION_ERROR", message: "VALIDATION_ERROR" },
});

export async function getConversationsAction(filters: unknown) {
  const parsed = conversationFiltersSchema.safeParse(filters);
  return parsed.success ? getConversations(parsed.data) : invalid();
}

export async function getConversationByIdAction(id: unknown) {
  const parsed = conversationIdSchema.safeParse(id);
  return parsed.success ? getConversationById(parsed.data) : invalid();
}

export async function getConversationUploadPolicyAction() {
  return getConversationUploadPolicy();
}

export async function prepareConversationUploadAction(input: unknown) {
  const parsed = prepareConversationUploadSchema.safeParse(input);
  return parsed.success ? prepareConversationUpload(parsed.data) : invalid();
}

export async function prepareConversationRecordingAction(input: unknown) {
  const parsed = prepareConversationUploadSchema.safeParse(input);
  return parsed.success ? prepareConversationRecording(parsed.data) : invalid();
}

export async function completeConversationUploadAction(input: unknown) {
  const parsed = completeConversationUploadSchema.safeParse(input);
  return parsed.success ? completeConversationUpload(parsed.data) : invalid();
}

export async function discardConversationUploadAction(input: unknown) {
  const parsed = discardConversationUploadSchema.safeParse(input);
  return parsed.success ? discardConversationUpload(parsed.data) : invalid();
}

export async function deleteConversationAction(input: unknown) {
  const parsed = deleteConversationSchema.safeParse(input);
  return parsed.success ? deleteConversation(parsed.data) : invalid();
}

export async function startConversationProcessingAction(input: unknown) {
  const parsed = startConversationProcessingSchema.safeParse(input);
  return parsed.success ? startConversationProcessing(parsed.data) : invalid();
}
