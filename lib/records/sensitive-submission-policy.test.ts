import { describe, expect, it } from "vitest";
import { hasExcludedSensitiveValues } from "./sensitive-submission-policy";

describe("bounded sensitive submission policy", () => {
  it.each(["4111 1111 1111 1111", "contraseña: example", "diagnóstico: private", "CVV: 123"])("blocks detected excluded content", (notes) => {
    expect(hasExcludedSensitiveValues({ notes })).toBe(true);
  });
  it("allows ordinary service notes and international contact details", () => {
    expect(hasExcludedSensitiveValues({ phone: "+5351234567", notes: "Repair the medical office air conditioner", company: null })).toBe(false);
    expect(hasExcludedSensitiveValues({ phone: "+4222222222222" })).toBe(false);
    expect(hasExcludedSensitiveValues({ notes: "4222222222222" })).toBe(true);
  });
});
