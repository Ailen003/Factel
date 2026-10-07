import { z } from "zod";

const internalReturnToSchema = z.string().trim().max(2048).optional();

export const beginTwoFactorEnrollmentSchema = z.object({
  password: z.string().min(1).max(128),
});

export const verifyTwoFactorEnrollmentSchema = z.object({
  code: z.string().trim().transform((value) => value.replace(/\s+/g, "")).pipe(z.string().regex(/^\d{6}$/)),
});

export const verifyTwoFactorTotpChallengeSchema = z.object({
  code: z.string().trim().transform((value) => value.replace(/\s+/g, "")).pipe(z.string().regex(/^\d{6}$/)),
  returnTo: internalReturnToSchema,
});

export const verifyTwoFactorBackupChallengeSchema = z.object({
  code: z.string().trim().min(1).max(128),
  returnTo: internalReturnToSchema,
});

export const regenerateTwoFactorBackupCodesSchema = z.object({
  password: z.string().min(1).max(128),
  confirmed: z.literal(true),
});

export type BeginTwoFactorEnrollmentInput = z.infer<
  typeof beginTwoFactorEnrollmentSchema
>;
export type VerifyTwoFactorEnrollmentInput = z.infer<
  typeof verifyTwoFactorEnrollmentSchema
>;
export type VerifyTwoFactorTotpChallengeInput = z.infer<
  typeof verifyTwoFactorTotpChallengeSchema
>;
export type VerifyTwoFactorBackupChallengeInput = z.infer<
  typeof verifyTwoFactorBackupChallengeSchema
>;
export type RegenerateTwoFactorBackupCodesInput = z.infer<
  typeof regenerateTwoFactorBackupCodesSchema
>;
