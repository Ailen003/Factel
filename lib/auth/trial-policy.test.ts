import { describe, expect, it } from "vitest";
import {
  isTemporaryPasswordExpired,
  temporaryPasswordExpiresAt,
  trialExpiresAt,
} from "./trial-policy";

describe("controlled trial time policy", () => {
  it("expires a temporary credential exactly 72 hours after provisioning", () => {
    const provisionedAt = new Date("2026-09-09T10:00:00.000Z");
    const expiresAt = temporaryPasswordExpiresAt(provisionedAt);
    expect(expiresAt.toISOString()).toBe("2026-09-12T10:00:00.000Z");
    expect(isTemporaryPasswordExpired(expiresAt, new Date("2026-09-12T09:59:59.999Z"))).toBe(false);
    expect(isTemporaryPasswordExpired(expiresAt, new Date("2026-09-12T10:00:00.000Z"))).toBe(true);
  });

  it("calculates 14 days from completed activation without mutating the input", () => {
    const activatedAt = new Date("2026-09-10T15:30:00.000Z");
    expect(trialExpiresAt(activatedAt).toISOString()).toBe("2026-09-24T15:30:00.000Z");
    expect(activatedAt.toISOString()).toBe("2026-09-10T15:30:00.000Z");
  });
});
