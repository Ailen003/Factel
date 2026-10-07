import { z } from "zod";

export function createTotpChallengeSchema(messages: { invalidTotp: string }) {
  return z.object({
    code: z.string().trim().regex(/^\d{6}$/, messages.invalidTotp),
  });
}

export function createBackupChallengeSchema(messages: { backupCodeRequired: string }) {
  return z.object({
    code: z.string().trim().min(1, messages.backupCodeRequired).max(128, messages.backupCodeRequired),
  });
}

export type TotpChallengeFormValues = z.infer<ReturnType<typeof createTotpChallengeSchema>>;
export type BackupChallengeFormValues = z.infer<ReturnType<typeof createBackupChallengeSchema>>;
