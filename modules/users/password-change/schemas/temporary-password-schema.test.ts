import { describe, expect, it } from "vitest";
import { temporaryPasswordSchema } from "./temporary-password-schema";

describe("temporary-password schema", () => {
  it("accepts a distinct matching replacement", () => {
    expect(temporaryPasswordSchema.safeParse({
      currentPassword: "temporary-password",
      newPassword: "new-password",
      confirmPassword: "new-password",
    }).success).toBe(true);
  });

  it("rejects the temporary password as the replacement and mismatched confirmation", () => {
    expect(temporaryPasswordSchema.safeParse({
      currentPassword: "same-password",
      newPassword: "same-password",
      confirmPassword: "same-password",
    }).success).toBe(false);
    expect(temporaryPasswordSchema.safeParse({
      currentPassword: "temporary-password",
      newPassword: "new-password",
      confirmPassword: "different-password",
    }).success).toBe(false);
  });
});
