"use server";

import {
  beginTwoFactorEnrollmentSchema,
  regenerateTwoFactorBackupCodesSchema,
  verifyTwoFactorBackupChallengeSchema,
  verifyTwoFactorEnrollmentSchema,
  verifyTwoFactorTotpChallengeSchema,
  type BeginTwoFactorEnrollmentInput,
  type RegenerateTwoFactorBackupCodesInput,
  type VerifyTwoFactorBackupChallengeInput,
  type VerifyTwoFactorEnrollmentInput,
  type VerifyTwoFactorTotpChallengeInput,
} from "../schemas";
import {
  beginTwoFactorEnrollment,
  getTwoFactorStatus,
  regenerateTwoFactorBackupCodes,
  verifyTwoFactorBackupChallenge,
  verifyTwoFactorEnrollment,
  verifyTwoFactorTotpChallenge,
} from "../services/two-factor.services";
import type {
  TwoFactorActionResult,
  TwoFactorBackupCodesData,
  TwoFactorChallengeData,
  TwoFactorEnrollmentCompleteData,
  TwoFactorEnrollmentData,
  TwoFactorStatus,
} from "../types";

function invalid<T>(): TwoFactorActionResult<T> {
  return { success: false, error: { code: "INVALID_INPUT", message: "Invalid input" } };
}

export async function getTwoFactorStatusAction(): Promise<TwoFactorActionResult<TwoFactorStatus>> {
  return await getTwoFactorStatus();
}

export async function beginTwoFactorEnrollmentAction(
  input: BeginTwoFactorEnrollmentInput,
): Promise<TwoFactorActionResult<TwoFactorEnrollmentData>> {
  const parsed = beginTwoFactorEnrollmentSchema.safeParse(input);
  return parsed.success ? await beginTwoFactorEnrollment(parsed.data) : invalid();
}

export async function verifyTwoFactorEnrollmentAction(
  input: VerifyTwoFactorEnrollmentInput,
): Promise<TwoFactorActionResult<TwoFactorEnrollmentCompleteData>> {
  const parsed = verifyTwoFactorEnrollmentSchema.safeParse(input);
  return parsed.success ? await verifyTwoFactorEnrollment(parsed.data) : invalid();
}

export async function verifyTwoFactorTotpChallengeAction(
  input: VerifyTwoFactorTotpChallengeInput,
): Promise<TwoFactorActionResult<TwoFactorChallengeData>> {
  const parsed = verifyTwoFactorTotpChallengeSchema.safeParse(input);
  return parsed.success ? await verifyTwoFactorTotpChallenge(parsed.data) : invalid();
}

export async function verifyTwoFactorBackupChallengeAction(
  input: VerifyTwoFactorBackupChallengeInput,
): Promise<TwoFactorActionResult<TwoFactorChallengeData>> {
  const parsed = verifyTwoFactorBackupChallengeSchema.safeParse(input);
  return parsed.success ? await verifyTwoFactorBackupChallenge(parsed.data) : invalid();
}

export async function regenerateTwoFactorBackupCodesAction(
  input: RegenerateTwoFactorBackupCodesInput,
): Promise<TwoFactorActionResult<TwoFactorBackupCodesData>> {
  const parsed = regenerateTwoFactorBackupCodesSchema.safeParse(input);
  return parsed.success ? await regenerateTwoFactorBackupCodes(parsed.data) : invalid();
}
