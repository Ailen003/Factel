// Bounded deterministic checks, not a guarantee of comprehensive detection.
// A match blocks the whole submission before any content is persisted.
function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = digits.length - 1, alternate = false; i >= 0; i--, alternate = !alternate) {
    let digit = Number(digits[i]);
    if (alternate && (digit *= 2) > 9) digit -= 9;
    sum += digit;
  }
  return sum % 10 === 0 && !/^(\d)\1+$/.test(digits);
}

export function hasExcludedSensitiveValues(values: Record<string, string | null>): boolean {
  return Object.entries(values).some(([field, value]) => {
    if (!value) return false;
    if (/\b(?:password|contrase[nñ]a|api[_ -]?key|secret[_ -]?key|cvv|cvc)\s*[:=]\s*\S+/i.test(value)) return true;
    if (/\b(?:diagnosis|diagn[oó]stico|medical record|historia cl[ií]nica|medication|medicaci[oó]n)\s*[:=]\s*\S+/i.test(value)) return true;
    // Phone is already validated as an international contact. Long legitimate
    // telephone numbers can also satisfy Luhn; that alone is not payment data.
    if (field === "phone") return false;
    return Array.from(value.matchAll(/(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g))
      .some(([candidate]) => passesLuhn(candidate.replace(/\D/g, "")));
  });
}
