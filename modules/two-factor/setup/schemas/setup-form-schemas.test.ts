import { describe, expect, it } from "vitest";
import {
  createBackupCodesConfirmationSchema,
  createEnrollmentVerificationSchema,
  createRegenerationSchema,
} from "./setup-form-schemas";

describe("two-factor setup form schemas", () => {
  it("normalizes a pasted TOTP and requires exactly six digits", () => {
    const schema = createEnrollmentVerificationSchema({ invalidTotp: "invalid" });
    expect(schema.parse({ code: " 123456 " })).toEqual({ code: "123456" });
    expect(schema.safeParse({ code: "12345" }).success).toBe(false);
    expect(schema.safeParse({ code: "12345a" }).success).toBe(false);
  });

  it("requires explicit confirmation before leaving one-time backup codes", () => {
    const schema = createBackupCodesConfirmationSchema({ confirmationRequired: "required" });
    expect(schema.safeParse({ saved: false }).success).toBe(false);
    expect(schema.safeParse({ saved: true }).success).toBe(true);
  });

  it("requires both password and destructive confirmation for regeneration", () => {
    const schema = createRegenerationSchema({ passwordRequired: "password", confirmationRequired: "confirm" });
    expect(schema.safeParse({ password: "", confirmed: true }).success).toBe(false);
    expect(schema.safeParse({ password: "correct horse", confirmed: false }).success).toBe(false);
    expect(schema.safeParse({ password: "correct horse", confirmed: true }).success).toBe(true);
  });
});
