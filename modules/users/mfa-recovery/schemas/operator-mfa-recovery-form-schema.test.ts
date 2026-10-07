import { describe, expect, it } from "vitest";
import { operatorMfaRecoveryFormSchemaFactory } from "./operator-mfa-recovery-form-schema";

const schema = operatorMfaRecoveryFormSchemaFactory({
  confirmationRequired: "confirm",
  passwordRequired: "password",
  reasonRequired: "reason",
  referenceInvalid: "reference invalid",
  referenceTooLong: "reference long",
  totpInvalid: "totp",
});

const valid = {
  reason: "lost_all_factors" as const,
  operationalReference: "OPS-2026-104",
  password: "current-password",
  totpCode: "123456",
  confirmed: true,
};

describe("operator MFA recovery form schema", () => {
  it("accepts structured recovery confirmation and trims the safe reference", () => {
    expect(schema.parse({ ...valid, operationalReference: "  OPS-2026-104  " }))
      .toEqual(valid);
  });

  it("requires password, a six-digit code, and explicit confirmation", () => {
    const result = schema.safeParse({
      ...valid,
      password: "",
      totpCode: "12345x",
      confirmed: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain("password");
      expect(result.error.flatten().fieldErrors.totpCode).toContain("totp");
      expect(result.error.flatten().fieldErrors.confirmed).toContain("confirm");
    }
  });

  it("rejects line breaks and overlong operational references", () => {
    expect(schema.safeParse({ ...valid, operationalReference: "ticket\nsecret" }).success)
      .toBe(false);
    expect(schema.safeParse({ ...valid, operationalReference: "x".repeat(121) }).success)
      .toBe(false);
  });
});
