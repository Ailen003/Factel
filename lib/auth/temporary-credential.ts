import "server-only";

import { randomBytes } from "node:crypto";

const TEMPORARY_PASSWORD_BYTES = 24;

export function generateTemporaryPassword(): string {
  return randomBytes(TEMPORARY_PASSWORD_BYTES).toString("base64url");
}
