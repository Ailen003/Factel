import { z } from "zod";
import type { AdminProfile } from "@/lib/auth/types";

export const adminProfileMutationSchema = z.object({
  operationId: z.string().uuid(),
  targetUserId: z.string().trim().min(1).max(191),
  expectedVersion: z.number().int().nonnegative(),
  confirmed: z.literal(true),
});

export type AdminProfileMutationDto = z.infer<typeof adminProfileMutationSchema>;

export interface AdminProfileMutationResult {
  userId: string;
  adminProfile: AdminProfile | null;
  adminProfileVersion: number;
  revokedSessions: number;
  replayed: boolean;
}
