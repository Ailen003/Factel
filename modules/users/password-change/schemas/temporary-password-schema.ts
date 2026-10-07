import { z } from "zod";

export interface TemporaryPasswordValidationMessages {
  currentPasswordRequired: string;
  passwordLength: string;
  passwordMustChange: string;
  passwordMismatch: string;
}

export function temporaryPasswordSchemaFactory(
  messages: TemporaryPasswordValidationMessages,
) {
  return z
    .object({
      currentPassword: z
        .string()
        .min(1, messages.currentPasswordRequired)
        .max(128, messages.passwordLength),
      newPassword: z
        .string()
        .min(8, messages.passwordLength)
        .max(128, messages.passwordLength),
      confirmPassword: z.string(),
    })
    .superRefine((values, context) => {
      if (values.currentPassword === values.newPassword) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["newPassword"],
          message: messages.passwordMustChange,
        });
      }
      if (values.newPassword !== values.confirmPassword) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirmPassword"],
          message: messages.passwordMismatch,
        });
      }
    });
}

export const temporaryPasswordSchema = temporaryPasswordSchemaFactory({
  currentPasswordRequired: "Current password is required",
  passwordLength: "Password must contain between 8 and 128 characters",
  passwordMustChange: "New password must differ from the temporary password",
  passwordMismatch: "Passwords do not match",
});

export type TemporaryPasswordSchema = z.infer<typeof temporaryPasswordSchema>;
