import { describe, expect, it } from "vitest";
import { platformSettingsSchema } from "./platform-settings-schema";

describe("platform settings schema", () => {
  it("normalizes a valid business email", () => {
    expect(
      platformSettingsSchema.parse({
        accessContactEmail: "  DEMO@EXAMPLE.COM ",
      }),
    ).toEqual({
      accessContactEmail: "demo@example.com",
    });
  });

  it("rejects an invalid email and has no admission-control field", () => {
    expect(
      platformSettingsSchema.safeParse({
        accessContactEmail: "invalid",
      }).success,
    ).toBe(false);
    expect("accessRequestsEnabled" in platformSettingsSchema.shape).toBe(false);
  });
});
