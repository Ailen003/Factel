/** Closed, lossless token mapping for extraction only; never guesses a country or digits. */
const digits: Readonly<Record<string, string>> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9",
  cero: "0", uno: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5",
  seis: "6", siete: "7", ocho: "8", nueve: "9",
};

export function normalizeSpokenPhone(observed: string): string | null {
  const tokens = observed.trim().toLowerCase().replace(/[\s(),.\-]+/g, " ")
    .replace(/\+/g, " + ").trim().split(/\s+/);
  let result = "";
  for (const [index, token] of tokens.entries()) {
    if (index === 0 && ["+", "plus", "más", "mas"].includes(token)) {
      result = "+";
    } else if (/^\d+$/.test(token)) {
      result += token;
    } else if (Object.hasOwn(digits, token)) {
      result += digits[token];
    } else {
      // Reject prose, alternatives, extensions, number groups and repeat instructions.
      return null;
    }
  }
  return /^\+?\d+$/.test(result) ? result : null;
}
