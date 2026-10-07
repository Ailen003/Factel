import { describe, expect, it } from "vitest";
import { visibleNavigationPaths } from "./navigation-access";

describe("role-filtered navigation", () => {
  it("hides administration from trial users", () => {
    expect(visibleNavigationPaths(false)).toEqual(["/dashboard", "/conversations", "/clients", "/requests"]);
  });

  it("shows administration when the server grants the capability", () => {
    expect(visibleNavigationPaths(true)).toContain("/users");
    expect(visibleNavigationPaths(true)).toContain("/settings");
    expect(visibleNavigationPaths(true)).toContain("/clients");
    expect(visibleNavigationPaths(true)).toContain("/requests");
    expect(visibleNavigationPaths(true)).toContain("/conversations");
  });

  it("hides administration from an unprofiled administrator", () => {
    expect(visibleNavigationPaths(false)).not.toContain("/users");
    expect(visibleNavigationPaths(false)).not.toContain("/settings");
  });

  it("does not expose settings to trial users", () => {
    expect(visibleNavigationPaths(false)).not.toContain("/settings");
  });
});
