import { z } from "zod";

export function createEnrollmentPasswordSchema(messages: { passwordRequired: string }) {
  return z.object({
    password: z.string().min(1, messages.passwordRequired),
  });
}

export function createEnrollmentVerificationSchema(messages: { invalidTotp: string }) {
  return z.object({
    code: z.string().trim().regex(/^\d{6}$/, messages.invalidTotp),
  });
}

export function createBackupCodesConfirmationSchema(messages: { confirmationRequired: string }) {
  return z.object({
    saved: z.boolean().refine((value) => value, messages.confirmationRequired),
  });
}

export function createRegenerationSchema(messages: {
  passwordRequired: string;
  confirmationRequired: string;
}) {
  return z.object({
    password: z.string().min(1, messages.passwordRequired),
    confirmed: z.boolean().refine((value) => value, messages.confirmationRequired),
  });
}

export type EnrollmentPasswordFormValues = z.infer<ReturnType<typeof createEnrollmentPasswordSchema>>;
export type EnrollmentVerificationFormValues = z.infer<ReturnType<typeof createEnrollmentVerificationSchema>>;
export type BackupCodesConfirmationFormValues = z.infer<ReturnType<typeof createBackupCodesConfirmationSchema>>;
export type RegenerationFormValues = z.infer<ReturnType<typeof createRegenerationSchema>>;
