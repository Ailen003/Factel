export function getManualTotpSecret(totpURI: string): string | null {
  try {
    if (!totpURI.startsWith("otpauth://totp/")) return null;
    const secret = new URL(totpURI).searchParams.get("secret")?.trim();
    return secret || null;
  } catch {
    return null;
  }
}
