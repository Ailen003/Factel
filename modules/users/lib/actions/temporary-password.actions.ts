"use server";

import { temporaryPasswordSchema } from "../../password-change/schemas/temporary-password-schema";
import {
  changeTemporaryPassword,
  getTemporaryPasswordState,
} from "../services/temporary-password.services";

const validationError = () => ({
  success: false as const,
  error: { code: "VALIDATION_ERROR", message: "Invalid password change" },
});

export async function getTemporaryPasswordStateAction() {
  return getTemporaryPasswordState();
}

export async function changeTemporaryPasswordAction(input: unknown) {
  const parsed = temporaryPasswordSchema.safeParse(input);
  return parsed.success
    ? changeTemporaryPassword({
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      })
    : validationError();
}
