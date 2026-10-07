"use server";

import {
  confirmTemporaryCredentialDeliverySchema,
  reissueTemporaryCredentialSchema,
} from "../types/temporary-credential-reissue.types";
import {
  confirmTemporaryCredentialDelivery,
  reissueTemporaryCredential,
} from "../services/temporary-credential-reissue.services";

const validationError = () => ({
  success: false as const,
  error: { code: "VALIDATION_ERROR", message: "Invalid credential operation" },
});

export async function reissueTemporaryCredentialAction(input: unknown) {
  const parsed = reissueTemporaryCredentialSchema.safeParse(input);
  if (!parsed.success) return validationError();
  return reissueTemporaryCredential({
    ...parsed.data,
    reasonNote:
      parsed.data.reason === "other" ? parsed.data.reasonNote?.trim() : undefined,
  });
}

export async function confirmTemporaryCredentialDeliveryAction(input: unknown) {
  const parsed = confirmTemporaryCredentialDeliverySchema.safeParse(input);
  return parsed.success
    ? confirmTemporaryCredentialDelivery(parsed.data)
    : validationError();
}
