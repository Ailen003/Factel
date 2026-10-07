import type { ServiceResponse } from "@/lib/api-responses";

export type TwoFactorStatus =
  | { status: "password-change-required" }
  | { status: "enrollment-required" }
  | { status: "enabled" };

export interface TwoFactorEnrollmentData {
  totpURI: string;
  manualSecret: string;
  backupCodes: string[];
}

export interface TwoFactorEnrollmentCompleteData {
  revokedSessions: number;
}

export interface TwoFactorChallengeData {
  returnTo: string;
}

export interface TwoFactorBackupCodesData {
  backupCodes: string[];
  revokedSessions: number;
}

export type TwoFactorActionResult<T> = ServiceResponse<T>;
