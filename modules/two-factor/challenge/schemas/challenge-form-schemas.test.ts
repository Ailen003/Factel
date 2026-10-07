import { describe, expect, it } from "vitest";
import { createBackupChallengeSchema, createTotpChallengeSchema } from "./challenge-form-schemas";

describe("two-factor challenge form schemas", () => {
  it("accepts only a complete six-digit authenticator code", () => {
    const schema = createTotpChallengeSchema({ invalidTotp: "invalid" });
    expect(schema.parse({ code: " 654321 " })).toEqual({ code: "654321" });
    expect(schema.safeParse({ code: "65432" }).success).toBe(false);
    expect(schema.safeParse({ code: "65432x" }).success).toBe(false);
  });

  it("trims a pasted backup code without prescribing Better Auth's code format", () => {
    const schema = createBackupChallengeSchema({ backupCodeRequired: "required" });
    expect(schema.parse({ code: "  alpha-beta  " })).toEqual({ code: "alpha-beta" });
    expect(schema.safeParse({ code: "   " }).success).toBe(false);
  });
});
