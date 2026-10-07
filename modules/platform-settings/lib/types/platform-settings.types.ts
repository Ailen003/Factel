import { z } from "zod";

export interface PlatformSettings {
  accessContactEmail: string;
  accessRequestsEnabled: boolean;
  version: number;
  configured: boolean;
  updatedAt: string | null;
  canUpdateContact: boolean;
  canPause: boolean;
  canResume: boolean;
}

export interface PublicAccessContactSettings {
  available: boolean;
}

export const updatePlatformContactEmailSchema = z.object({
  accessContactEmail: z.string().trim().toLowerCase().email().max(320),
  expectedVersion: z.number().int().nonnegative(),
});

export const platformAdmissionMutationSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});

export type UpdatePlatformContactEmailDto = z.infer<
  typeof updatePlatformContactEmailSchema
>;
export type PlatformAdmissionMutationDto = z.infer<
  typeof platformAdmissionMutationSchema
>;
