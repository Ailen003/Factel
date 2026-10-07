import { z } from "zod";

export interface OwnershipTransferValidationMessages {
  confirmationRequired: string;
  passwordRequired: string;
  totpInvalid: string;
}

export function ownershipTransferFormSchemaFactory(
  messages: OwnershipTransferValidationMessages,
) {
  return z.object({
    password: z.string().min(1, messages.passwordRequired).max(1024),
    totpCode: z.string().regex(/^\d{6}$/, messages.totpInvalid),
    confirmed: z.boolean().refine(Boolean, messages.confirmationRequired),
  });
}

export type OwnershipTransferFormSchema = z.infer<
  ReturnType<typeof ownershipTransferFormSchemaFactory>
>;
