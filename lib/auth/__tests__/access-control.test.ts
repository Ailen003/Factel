import { describe, expect, it } from "vitest";
import { platformAdminRole } from "../access-control";

describe("Better Auth administrative access control", () => {
  it.each(["create", "update", "set-role", "set-password", "delete"] as const)(
    "denies the generic user %s permission",
    (permission) => {
      expect(platformAdminRole.authorize({ user: [permission] })).toMatchObject({
        success: false,
      });
    },
  );

  it("denies generic session administration", () => {
    expect(platformAdminRole.authorize({ session: ["revoke"] })).toMatchObject({
      success: false,
    });
  });
});
