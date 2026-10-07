"use server";

import { adminProfileMutationSchema } from "../types/admin-profile-mutation.types";
import {
  demoteOperatorToTrialUser,
  promoteUserToOperator,
} from "../services/admin-profile-mutation.services";

const validationError = () => ({
  success: false as const,
  error: { code: "VALIDATION_ERROR", message: "Invalid administrator operation" },
});

export async function promoteUserToOperatorAction(input: unknown) {
  const parsed = adminProfileMutationSchema.safeParse(input);
  return parsed.success ? promoteUserToOperator(parsed.data) : validationError();
}

export async function demoteOperatorToTrialUserAction(input: unknown) {
  const parsed = adminProfileMutationSchema.safeParse(input);
  return parsed.success ? demoteOperatorToTrialUser(parsed.data) : validationError();
}
