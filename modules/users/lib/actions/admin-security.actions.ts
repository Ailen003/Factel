"use server";

import {
  initiateOwnershipTransferSchema,
  operatorMfaRecoverySchema,
  resolveOwnershipTransferSchema,
} from "../types/admin-security.types";
import {
  acceptOwnershipTransfer,
  cancelOwnershipTransfer,
  declineOwnershipTransfer,
  getCurrentOwnershipTransfer,
  initiateOwnershipTransfer,
  recoverOperatorMfa,
} from "../services/admin-security.services";

const validationError = () => ({
  success: false as const,
  error: { code: "VALIDATION_ERROR", message: "Invalid administrative security operation" },
});

export async function recoverOperatorMfaAction(input: unknown) {
  const parsed = operatorMfaRecoverySchema.safeParse(input);
  return parsed.success ? recoverOperatorMfa(parsed.data) : validationError();
}

export async function initiateOwnershipTransferAction(input: unknown) {
  const parsed = initiateOwnershipTransferSchema.safeParse(input);
  return parsed.success ? initiateOwnershipTransfer(parsed.data) : validationError();
}

export async function cancelOwnershipTransferAction(input: unknown) {
  const parsed = resolveOwnershipTransferSchema.safeParse(input);
  return parsed.success ? cancelOwnershipTransfer(parsed.data) : validationError();
}

export async function declineOwnershipTransferAction(input: unknown) {
  const parsed = resolveOwnershipTransferSchema.safeParse(input);
  return parsed.success ? declineOwnershipTransfer(parsed.data) : validationError();
}

export async function acceptOwnershipTransferAction(input: unknown) {
  const parsed = resolveOwnershipTransferSchema.safeParse(input);
  return parsed.success ? acceptOwnershipTransfer(parsed.data) : validationError();
}

export async function getCurrentOwnershipTransferAction() {
  return getCurrentOwnershipTransfer();
}
