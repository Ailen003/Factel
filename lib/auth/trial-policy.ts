export const TEMPORARY_PASSWORD_TTL_HOURS = 72;
export const TRIAL_DURATION_DAYS = 14;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function temporaryPasswordExpiresAt(provisionedAt: Date): Date {
  return new Date(
    provisionedAt.getTime() + TEMPORARY_PASSWORD_TTL_HOURS * HOUR_MS,
  );
}

export function trialExpiresAt(activatedAt: Date): Date {
  return new Date(activatedAt.getTime() + TRIAL_DURATION_DAYS * DAY_MS);
}

export function isTemporaryPasswordExpired(
  expiresAt: Date | null,
  now = new Date(),
): boolean {
  return !expiresAt || expiresAt.getTime() <= now.getTime();
}
