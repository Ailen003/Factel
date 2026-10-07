import { z } from "zod";

export const mfaRecoveryReasons = [
  "lost_all_factors",
  "lost_device",
  "suspected_compromise",
  "operational_recovery",
  "other",
] as const;

const operationId = z.string().uuid();
const userId = z.string().trim().min(1).max(191);
const expectedVersion = z.number().int().nonnegative();
const password = z.string().min(1).max(1024);
const totpCode = z.string().regex(/^\d{6}$/);
const confirmed = z.literal(true);
const operationalReference = z.string().trim().max(120)
  .regex(/^[^\r\n\t]*$/)
  .transform((value) => value || undefined)
  .optional();

export const operatorMfaRecoverySchema = z.object({
  operationId,
  targetUserId: userId,
  expectedAdminProfileVersion: expectedVersion,
  reason: z.enum(mfaRecoveryReasons),
  operationalReference,
  password,
  totpCode,
  confirmed,
}).strict();

export type OperatorMfaRecoveryDto = z.infer<typeof operatorMfaRecoverySchema>;

export interface OperatorMfaRecoveryResult {
  targetUserId: string;
  adminProfileVersion: number;
  revokedSessions: number;
  replayed: boolean;
}

const transferStepUp = {
  operationId,
  password,
  totpCode,
  confirmed,
} as const;

export const initiateOwnershipTransferSchema = z.object({
  ...transferStepUp,
  targetUserId: userId,
  expectedOwnerVersion: expectedVersion,
  expectedTargetVersion: expectedVersion,
}).strict();

export const resolveOwnershipTransferSchema = z.object({
  ...transferStepUp,
  transferId: userId,
}).strict();

export type InitiateOwnershipTransferDto = z.infer<
  typeof initiateOwnershipTransferSchema
>;
export type ResolveOwnershipTransferDto = z.infer<
  typeof resolveOwnershipTransferSchema
>;

export type OwnershipTransferStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired"
  | "invalidated";

export interface OwnershipTransferView {
  id: string;
  ownerUserId: string;
  ownerName: string;
  targetUserId: string;
  targetName: string;
  ownerVersion: number;
  targetVersion: number;
  status: OwnershipTransferStatus;
  initiatedAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  canCancel: boolean;
  canAccept: boolean;
  canDecline: boolean;
}

export interface OwnershipTransferMutationResult {
  transfer: OwnershipTransferView;
  revokedOwnerSessions: number;
  revokedTargetSessions: number;
  replayed: boolean;
}
