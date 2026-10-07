import { z } from "zod";
import {
  temporaryCredentialDeliveryChannels,
  temporaryCredentialReasons,
} from "../../lib/types/temporary-credential-reissue.types";

export interface CredentialReissueValidationMessages {
  reasonRequired: string;
  noteRequired: string;
  noteTooLong: string;
  confirmationRequired: string;
  channelRequired: string;
}

export function credentialReissueFormSchemaFactory(
  messages: CredentialReissueValidationMessages,
) {
  return z
    .object({
      reason: z.enum(temporaryCredentialReasons, {
        message: messages.reasonRequired,
      }),
      reasonNote: z.string().trim().max(200, messages.noteTooLong).optional(),
      confirmed: z.boolean().refine(Boolean, messages.confirmationRequired),
    })
    .superRefine((values, context) => {
      if (values.reason === "other" && !values.reasonNote) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reasonNote"],
          message: messages.noteRequired,
        });
      }

      if (values.reason !== "other" && values.reasonNote) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reasonNote"],
          message: messages.noteRequired,
        });
      }
    });
}

export function credentialDeliveryFormSchemaFactory(
  messages: CredentialReissueValidationMessages,
) {
  return z.object({
    channel: z.enum(temporaryCredentialDeliveryChannels, {
      message: messages.channelRequired,
    }),
  });
}

export type CredentialReissueFormSchema = z.infer<
  ReturnType<typeof credentialReissueFormSchemaFactory>
>;
export type CredentialDeliveryFormSchema = z.infer<
  ReturnType<typeof credentialDeliveryFormSchemaFactory>
>;
