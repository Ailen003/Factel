import { z } from "zod";
import type { AdminProfile, AppLocale, AppRole, UserStatus } from "@/lib/auth/types";
import type { CreateUserSchema } from "../../form/create/schemas/create-user-schema";
import type { EditUserSchema } from "../../form/edit/schemas/edit-user-schema";
import type { TemporaryCredentialIssuanceMetadata } from "./temporary-credential-reissue.types";

export type UserRole = AppRole;
export type { AppLocale, UserStatus };

export const userRoleConfig: Record<UserRole, { className: string }> = {
  platform_admin: { className: "bg-indigo-100 text-indigo-600" },
  trial_user: { className: "bg-blue-100 text-blue-600" },
};
export const userStatusConfig: Record<UserStatus, { className: string }> = {
  active: { className: "bg-green-100 text-green-600" },
  suspended: { className: "bg-gray-100 text-gray-600" },
};
export const getUserRoleInfo = (role: UserRole) => userRoleConfig[role];
export const getUserStatusInfo = (status: UserStatus) => userStatusConfig[status];
export const getUserRoleLabel = (role: UserRole, t: (key: string) => string) => t(role);
export const getUserStatusLabel = (status: UserStatus, t: (key: string) => string) => t(status);

export type UserAccessState =
  | "active"
  | "suspended"
  | "temporary_pending"
  | "temporary_expired";

export const userAccessStateConfig: Record<UserAccessState, { className: string }> = {
  active: { className: "bg-green-100 text-green-700" },
  suspended: { className: "bg-gray-100 text-gray-700" },
  temporary_pending: { className: "bg-amber-100 text-amber-700" },
  temporary_expired: { className: "bg-red-100 text-red-700" },
};

export function getUserAccessState(user: User, now = new Date()): UserAccessState {
  if (user.status === "suspended") return "suspended";
  if (!user.temporaryPasswordChangeRequired) return "active";
  const expiry = user.temporaryPasswordExpiresAt
    ? new Date(user.temporaryPasswordExpiresAt)
    : null;
  return !expiry || Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()
    ? "temporary_expired"
    : "temporary_pending";
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  adminProfile: AdminProfile | null;
  adminProfileVersion: number;
  twoFactorEnabled: boolean;
  twoFactorVerified: boolean;
  status: UserStatus;
  locale: AppLocale;
  initialCreditAllocation: number;
  temporaryPasswordChangeRequired: boolean;
  temporaryPasswordExpiresAt: string | null;
  temporaryPasswordPurpose: "activation" | "recovery" | null;
  temporaryCredentialVersion: number;
  latestTemporaryCredentialIssuance: TemporaryCredentialIssuanceMetadata | null;
  trialActivatedAt: string | null;
  trialExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export type UserDetails = User;

export interface UsersResponse {
  users: User[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const userFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().refine((value) => [5, 10, 20, 30].includes(value)).catch(10),
  search: z.string().trim().max(100).optional(),
  role: z.enum(["platform_admin", "trial_user"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  sortBy: z.enum(["fullName", "email", "role", "status", "createdAt"]).catch("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).catch("desc"),
});
export type UserFiltersDto = z.infer<typeof userFiltersSchema>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseUserFilters(
  params: Record<string, string | string[] | undefined>,
): UserFiltersDto {
  return userFiltersSchema.parse({
    page: first(params.page),
    limit: first(params.limit),
    search: first(params.search) || undefined,
    role: first(params.role) || undefined,
    status: first(params.status) || undefined,
    sortBy: first(params.sortBy),
    sortOrder: first(params.sortOrder),
  });
}

export interface CreateUserDto {
  name: string;
  email: string;
  locale: AppLocale;
  initialCreditAllocation: number;
}
export const convertCreateUserDto = (schema: CreateUserSchema): CreateUserDto => ({
  name: schema.name.trim(),
  email: schema.email.trim().toLowerCase(),
  locale: schema.locale,
  initialCreditAllocation: schema.initialCreditAllocation,
});

export interface ProvisionedTrialUser {
  user: UserDetails;
  temporaryPassword: string;
  temporaryPasswordExpiresAt: string;
}

export interface EditUserDto { name: string; locale: AppLocale }
export const convertEditUserDto = (schema: EditUserSchema): EditUserDto => ({
  name: schema.name.trim(),
  locale: schema.locale,
});

export interface UserStatusResult {
  user: UserDetails;
  revokedSessions: number;
}

export interface UserMutationResult {
  userId: string;
  revokedSessions: number;
}

export interface UsersStats {
  totalUsers: number;
  platformAdmins: number;
  trialUsers: number;
  active: number;
  suspended: number;
}
