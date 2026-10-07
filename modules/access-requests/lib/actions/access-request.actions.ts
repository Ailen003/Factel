"use server";

import { createAccessRequestSchema } from "../../form/create/schemas/create-access-request-schema";
import { prepareAccessRequest } from "../services/access-request.services";

const validationError = () => ({
  success: false as const,
  error: { code: "VALIDATION_ERROR", message: "Invalid access request" },
});

export async function prepareAccessRequestAction(input: unknown) {
  const parsed = createAccessRequestSchema.safeParse(input);
  return parsed.success ? prepareAccessRequest(parsed.data) : validationError();
}
