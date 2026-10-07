import { describe, expect, it } from "vitest";
import { getLoginDestination } from "./login-destination";

describe("getLoginDestination", () => {
  it("sends a two-factor redirect to the localized challenge and preserves a safe destination", () => {
    expect(getLoginDestination({
      data: { twoFactorRedirect: true },
      locale: "es",
      returnTo: "/settings?tab=security",
    })).toBe("/es/auth/two-factor?returnTo=%2Fsettings%3Ftab%3Dsecurity");
  });

  it("rejects an external return target during a two-factor redirect", () => {
    expect(getLoginDestination({
      data: { twoFactorRedirect: true },
      locale: "en",
      returnTo: "//malicious.example/path",
    })).toBe("/en/auth/two-factor?returnTo=%2Fdashboard");
  });

  it("keeps temporary-password replacement ahead of the second-factor challenge", () => {
    expect(getLoginDestination({
      data: {
        twoFactorRedirect: true,
        user: { role: "platform_admin", temporaryPasswordChangeRequired: true },
      },
      locale: "en",
      returnTo: "/settings",
    })).toBe("/en/auth/change-password");
  });

  it("sends an administrator without an enabled factor directly to enrollment", () => {
    expect(getLoginDestination({
      data: {
        user: {
          role: "platform_admin",
          temporaryPasswordChangeRequired: false,
          twoFactorEnabled: false,
        },
      },
      locale: "es",
      returnTo: "/users?page=2",
    })).toBe("/es/auth/two-factor/setup?returnTo=%2Fusers%3Fpage%3D2");
  });
});
