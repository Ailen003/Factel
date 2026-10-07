import type { TemporaryPasswordSchema } from "../../password-change/schemas/temporary-password-schema";

export interface ChangeTemporaryPasswordDto {
  currentPassword: string;
  newPassword: string;
}

export function convertChangeTemporaryPasswordDto(
  values: TemporaryPasswordSchema,
): ChangeTemporaryPasswordDto {
  return {
    currentPassword: values.currentPassword,
    newPassword: values.newPassword,
  };
}

export type TemporaryPasswordState =
  | { status: "required"; purpose: "activation" | "recovery"; expiresAt: string }
  | { status: "expired"; purpose: "activation" | "recovery"; expiresAt: string | null }
  | { status: "complete"; trialExpiresAt: string | null };

export interface TemporaryPasswordReplacementResult {
  activatedAt: string;
  trialExpiresAt: string;
  revokedSessions: number;
  replayed: boolean;
}
