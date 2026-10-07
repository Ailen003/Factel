import { describe, expect, it } from "vitest";
import { getManualTotpSecret } from "./totp-uri";

describe("getManualTotpSecret", () => {
  it("extracts the transient secret only from a TOTP URI", () => {
    expect(getManualTotpSecret("otpauth://totp/TalkFlow?secret=ABC123&issuer=TalkFlow")).toBe("ABC123");
    expect(getManualTotpSecret("https://example.com/?secret=ABC123")).toBeNull();
    expect(getManualTotpSecret("not-a-uri")).toBeNull();
  });
});
