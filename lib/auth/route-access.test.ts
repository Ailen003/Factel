import { describe, expect, it } from "vitest";
import {
  canAccessPath,
  getSafeReturnTo,
  localizePath,
  isAllowedDuringTemporaryPasswordChange,
  stripLocale,
} from "./route-access";

describe("route access", () => {
  it("allows both roles into the dashboard and only admins into users", () => {
    expect(canAccessPath("/es/dashboard", "trial_user")).toBe(true);
    expect(canAccessPath("/en/users", "trial_user")).toBe(false);
    expect(canAccessPath("/en/users", "platform_admin")).toBe(true);
    expect(canAccessPath("/en/settings", "trial_user")).toBe(false);
    expect(canAccessPath("/en/settings", "platform_admin")).toBe(true);
  });

  it("rejects external and role-forbidden return targets", () => {
    expect(getSafeReturnTo("https://evil.example", "platform_admin")).toBe("/dashboard");
    expect(getSafeReturnTo("//evil.example/users", "platform_admin")).toBe("/dashboard");
    expect(getSafeReturnTo("/es/users?page=2", "trial_user")).toBe("/dashboard");
    expect(getSafeReturnTo("/unknown", "platform_admin")).toBe("/dashboard");
  });

  it("preserves an allowed internal target and localizes it once", () => {
    expect(getSafeReturnTo("/es/users?page=2", "platform_admin")).toBe("/es/users?page=2");
    expect(localizePath("en", "/es/users?page=2")).toBe("/en/users?page=2");
    expect(stripLocale("/es/dashboard")).toBe("/dashboard");
  });

  it("allows both roles to return to their localized client list after sign-in", () => {
    for (const role of ["trial_user", "platform_admin"] as const) {
      expect(canAccessPath("/es/clients", role)).toBe(true);
      expect(getSafeReturnTo("/es/clients?page=2&search=Ana", role)).toBe(
        "/es/clients?page=2&search=Ana",
      );
    }
  });

  it("allows both roles to return to a filtered localized request list", () => {
    for (const role of ["trial_user", "platform_admin"] as const) {
      expect(canAccessPath("/es/requests", role)).toBe(true);
      expect(getSafeReturnTo("/es/requests?status=pending", role)).toBe("/es/requests?status=pending");
    }
  });

  it("allows both roles to return to the localized conversations list", () => {
    for (const role of ["trial_user", "platform_admin"] as const) {
      expect(canAccessPath("/es/conversations", role)).toBe(true);
      expect(getSafeReturnTo("/es/conversations?status=AUDIO_READY", role)).toBe(
        "/es/conversations?status=AUDIO_READY",
      );
    }
  });

  it("limits a pending account to minimal auth state and sign out", () => {
    expect(isAllowedDuringTemporaryPasswordChange("GET", "/get-session")).toBe(false);
    expect(isAllowedDuringTemporaryPasswordChange("POST", "/sign-out")).toBe(true);
    expect(isAllowedDuringTemporaryPasswordChange("POST", "/change-password")).toBe(false);
    expect(isAllowedDuringTemporaryPasswordChange("POST", "/update-user")).toBe(false);
    expect(isAllowedDuringTemporaryPasswordChange("GET", "/list-sessions")).toBe(false);
  });
});
