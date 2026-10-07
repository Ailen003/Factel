import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateTemporaryPassword } from "./temporary-credential";

describe("temporary credential generation", () => {
  it("uses a server-generated 192-bit base64url credential", () => {
    const credentials = Array.from({ length: 32 }, generateTemporaryPassword);

    expect(new Set(credentials).size).toBe(credentials.length);
    for (const credential of credentials) {
      expect(credential).toHaveLength(32);
      expect(credential).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});
