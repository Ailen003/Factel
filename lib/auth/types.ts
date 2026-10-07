export const APP_ROLES = ["trial_user", "platform_admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ADMIN_PROFILES = ["owner", "operator"] as const;
export type AdminProfile = (typeof ADMIN_PROFILES)[number];

export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const APP_LOCALES = ["en", "es"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const TEMPORARY_PASSWORD_PURPOSES = ["activation", "recovery"] as const;
export type TemporaryPasswordPurpose = (typeof TEMPORARY_PASSWORD_PURPOSES)[number];

export interface AuthActor {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: AppRole;
  adminProfile: AdminProfile | null;
  status: UserStatus;
  locale: AppLocale;
  temporaryPasswordChangeRequired: boolean;
  temporaryPasswordExpiresAt: Date | null;
  temporaryPasswordPurpose: TemporaryPasswordPurpose | null;
  trialActivatedAt: Date | null;
  trialExpiresAt: Date | null;
  initialCreditAllocation: number;
  twoFactorEnabled: boolean;
  twoFactorVerified: boolean;
}

export interface AuthenticatedSession {
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  user: AuthActor;
}

export type AuthErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "ADMIN_PROFILE_REQUIRED"
  | "ADMIN_PROFILE_INCONSISTENT"
  | "ACCOUNT_INACTIVE"
  | "TEMPORARY_PASSWORD_CHANGE_REQUIRED"
  | "TEMPORARY_PASSWORD_EXPIRED"
  | "ADMIN_MFA_ENROLLMENT_REQUIRED";

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
  }
}
