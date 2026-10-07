import { z } from "zod";

export interface AccessRequestValidationMessages {
  nameRequired: string;
  invalidEmail: string;
  messageRequired: string;
  messageTooShort: string;
  tooLong: string;
}

export function createAccessRequestSchemaFactory(
  messages: AccessRequestValidationMessages,
) {
  return z.object({
    fullName: z.string().trim().min(2, messages.nameRequired).max(120, messages.tooLong),
    email: z.string().trim().toLowerCase().email(messages.invalidEmail).max(320, messages.invalidEmail),
    organization: z.string().trim().max(160, messages.tooLong),
    message: z
      .string()
      .trim()
      .min(1, messages.messageRequired)
      .min(20, messages.messageTooShort)
      .max(1000, messages.tooLong),
  });
}

export const createAccessRequestSchema = createAccessRequestSchemaFactory({
  nameRequired: "Name is required",
  invalidEmail: "Invalid email address",
  messageRequired: "Message is required",
  messageTooShort: "Message is too short",
  tooLong: "Field is too long",
});

export type CreateAccessRequestSchema = z.infer<typeof createAccessRequestSchema>;
