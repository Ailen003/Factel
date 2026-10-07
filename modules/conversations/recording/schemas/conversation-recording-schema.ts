import { z } from "zod";

export interface ConversationRecordingValidationMessages {
  consentRequired: string;
  localeRequired: string;
}

export function conversationRecordingSchemaFactory(messages: ConversationRecordingValidationMessages) {
  return z.object({
    consent: z.boolean().refine(Boolean, { message: messages.consentRequired }),
    locale: z.enum(["en", "es"], { message: messages.localeRequired }),
  });
}

export type ConversationRecordingSchema = z.infer<ReturnType<typeof conversationRecordingSchemaFactory>>;
