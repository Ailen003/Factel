/**
 * Price formatting utilities that avoid locale-sensitive APIs.
 * These utilities format prices deterministically to prevent hydration mismatches.
 */

/**
 * Format a price number as Mexican Pesos currency.
 * Uses deterministic formatting to avoid SSR/client hydration issues.
 * @param price - Price number
 * @returns Formatted price string (e.g., "$1,234.56") or "—" if price is null/undefined
 */
export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return "—";
  
  try {
    // Format with fixed decimal places and thousands separator
    const formatted = price.toFixed(2);
    const parts = formatted.split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `$${integerPart}.${parts[1]}`;
  } catch (error) {
    console.error("Error formatting price:", error);
    return "—";
  }
}

/**
 * Format a price number without currency symbol.
 * @param price - Price number
 * @returns Formatted price string (e.g., "1,234.56") or "—" if price is null/undefined
 */
export function formatPriceWithoutSymbol(price: number | null | undefined): string {
  if (price === null || price === undefined) return "—";
  
  try {
    const formatted = price.toFixed(2);
    const parts = formatted.split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${integerPart}.${parts[1]}`;
  } catch (error) {
    console.error("Error formatting price:", error);
    return "—";
  }
}
