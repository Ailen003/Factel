import { describe, expect, it } from "vitest";
import { ownershipTransferFormSchemaFactory } from "./ownership-transfer-form-schema";

const schema = ownershipTransferFormSchemaFactory({
  confirmationRequired: "confirm",
  passwordRequired: "password",
  totpInvalid: "totp",
});

describe("ownership transfer form schema", () => {
  it("accepts a complete reinforced confirmation", () => {
    expect(schema.safeParse({
      password: "current-password",
      totpCode: "123456",
      confirmed: true,
    }).success).toBe(true);
  });

  it("fails closed when any step-up input is missing or malformed", () => {
    const result = schema.safeParse({ password: "", totpCode: "12345", confirmed: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain("password");
      expect(result.error.flatten().fieldErrors.totpCode).toContain("totp");
      expect(result.error.flatten().fieldErrors.confirmed).toContain("confirm");
    }
  });
});
