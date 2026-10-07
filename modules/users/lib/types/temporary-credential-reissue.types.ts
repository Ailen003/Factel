import { z } from "zod";

export const temporaryCredentialReasons = [
  "expired_credential",
  "forgotten_password",
  "suspected_compromise",
  "failure_recovery",
  "other",
] as const;

export const temporaryCredentialDeliveryChannels = [
  "in_person",
  "phone",
  "secure_message",
  "other",
] as const;

export type TemporaryCredentialReason =
  (typeof temporaryCredentialReasons)[number];
export type TemporaryCredentialDeliveryChannel =
  (typeof temporaryCredentialDeliveryChannels)[number];
export type TemporaryCredentialIssuanceStatus =
  | "prepared"
  | "issued"
  | "superseded"
  | "failed";

const boundedId = z.string().trim().min(1).max(191);

export const reissueTemporaryCredentialSchema = z
  .object({
    targetUserId: boundedId,
    operationId: z.string().uuid(),
    expectedVersion: z.number().int().nonnegative(),
    reason: z.enum(temporaryCredentialReasons),
    reasonNote: z.string().trim().max(200).optional(),
    confirmed: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    const note = value.reasonNote?.trim();
    if (value.reason === "other" && !note) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasonNote"],
        message: "A note is required for the other reason",
      });
    }
    if (value.reason !== "other" && note) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reasonNote"],
        message: "A note is allowed only for the other reason",
      });
    }
  });

export const confirmTemporaryCredentialDeliverySchema = z
  .object({
    issuanceId: boundedId,
    expectedVersion: z.number().int().positive(),
    channel: z.enum(temporaryCredentialDeliveryChannels),
    confirmed: z.literal(true),
  })
  .strict();

export type ReissueTemporaryCredentialDto = z.infer<
  typeof reissueTemporaryCredentialSchema
>;
export type ConfirmTemporaryCredentialDeliveryDto = z.infer<
  typeof confirmTemporaryCredentialDeliverySchema
>;

export interface TemporaryCredentialIssuanceMetadata {
  id: string;
  version: number;
  purpose: "activation" | "recovery";
  reason: TemporaryCredentialReason;
  status: TemporaryCredentialIssuanceStatus;
  preparedAt: string;
  issuedAt: string | null;
  expiresAt: string | null;
  deliveredAt: string | null;
  deliveryChannel: TemporaryCredentialDeliveryChannel | null;
}

export interface ReissuedTemporaryCredentialResult {
  userId: string;
  suspended: boolean;
  temporaryPassword: string;
  revokedSessions: number;
  issuance: TemporaryCredentialIssuanceMetadata;
}

export interface TemporaryCredentialDeliveryResult {
  issuance: TemporaryCredentialIssuanceMetadata;
  replayed: boolean;
}
