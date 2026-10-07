import { describe, expect, it } from "vitest";
import { normalizeSpokenPhone } from "./spoken-phone";

describe("closed spoken phone normalization", () => {
  it.each([
    ["plus one, 4-1-5, 5-5-5, 0-1-8-2", "+14155550182"],
    ["plus one 415-555-0182", "+14155550182"],
    ["PLUS ONE FOUR ONE FIVE FIVE FIVE FIVE ZERO ONE EIGHT TWO", "+14155550182"],
    ["más cinco tres, cinco dos uno, cero cuatro seis siete ocho", "+5352104678"],
    ["+1 (415) 555.0182", "+14155550182"],
    ["415-555-0182", "4155550182"],
  ])("maps only explicitly spoken tokens: %s", (input, expected) => {
    expect(normalizeSpokenPhone(input)).toBe(expected);
  });
  it.each(["", "plus", "one plus two", "++123", "call 4155550182", "four or five",
    "double five", "twenty one", "cincuenta y tres", "4155550182 extension 2",
    "415/555/0182", "oh one", "__proto__", "constructor"])('does not guess "%s"', (input) => {
    expect(normalizeSpokenPhone(input)).toBeNull();
  });
});
