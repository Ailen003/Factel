import type { ConversationDetails } from "../lib/types/conversation.types";

export interface ConversationProcessingView {
  credits: ConversationDetails["credits"];
  run: ConversationDetails["processingRun"];
  transcript: ConversationDetails["transcript"];
  canStart: boolean;
  canContinue?: boolean;
  hasPreservedReview?: boolean;
}

export function getConversationProcessingView(conversation: ConversationDetails): ConversationProcessingView {
  const eligibleStatus = conversation.status === "audio_ready" || conversation.status === "failed";
  const hasActiveRun = conversation.processingRun?.status === "accepted" || conversation.processingRun?.status === "running";
  return {
    credits: conversation.credits,
    run: conversation.processingRun,
    transcript: conversation.transcript,
    canStart: eligibleStatus && !hasActiveRun && conversation.credits.available > 0,
    canContinue: conversation.status === "transcribed" && !!conversation.transcript && hasActiveRun,
    hasPreservedReview: conversation.processingRun?.status === "failed"
      && ["needs_review", "ready", "record_plan_pending"].includes(conversation.status),
  };
}
