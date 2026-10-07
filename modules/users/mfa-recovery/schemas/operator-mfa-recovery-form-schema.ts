import { z } from "zod";
import { mfaRecoveryReasons } from "../../lib/types/admin-security.types";

export interface OperatorMfaRecoveryValidationMessages {
  confirmationRequired: string;
  passwordRequired: string;
  reasonRequired: string;
  referenceInvalid: string;
  referenceTooLong: string;
  totpInvalid: string;
}

export function operatorMfaRecoveryFormSchemaFactory(
  messages: OperatorMfaRecoveryValidationMessages,
) {
  return z.object({
    reason: z.enum(mfaRecoveryReasons, { message: messages.reasonRequired }),
    operationalReference: z.string()
      .trim()
      .max(120, messages.referenceTooLong)
      .regex(/^[^\r\n\t]*$/, messages.referenceInvalid),
    password: z.string().min(1, messages.passwordRequired).max(1024),
    totpCode: z.string().regex(/^\d{6}$/, messages.totpInvalid),
    confirmed: z.boolean().refine(Boolean, messages.confirmationRequired),
  });
}

export type OperatorMfaRecoveryFormSchema = z.infer<
  ReturnType<typeof operatorMfaRecoveryFormSchemaFactory>
>;
