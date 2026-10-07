/**
 * Date formatting utilities that avoid timezone conversion.
 * Dates are expected as ISO 8601 strings in UTC.
 * These utilities format dates without converting to the browser's local timezone.
 */

/**
 * Format a date string without timezone conversion.
 * @param date - ISO 8601 date string in UTC
 * @param format - Format string (default: "DD/MM/YYYY HH:mm")
 * @returns Formatted date string or "—" if date is null/undefined
 */
export function formatDate(date: string | null, format: string = "DD/MM/YYYY HH:mm"): string {
  if (!date) return "—";

  try {
    const parsedDate = parseUTCDate(date);
    if (!parsedDate) return "—";

    return formatDateString(parsedDate, format);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "—";
  }
}

/**
 * Format date and time with default format "DD/MM/YYYY HH:mm"
 */
export function formatDateTime(date: string | null): string {
  return formatDate(date, "DD/MM/YYYY HH:mm");
}

/**
 * Format date only with format "DD/MM/YYYY"
 */
export function formatDateOnly(date: string | null): string {
  return formatDate(date, "DD/MM/YYYY");
}

/**
 * Parse an ISO 8601 date string without timezone conversion.
 * Returns the UTC components as a plain object.
 */
function parseUTCDate(dateString: string): { year: number; month: number; day: number; hours: number; minutes: number; seconds: number } | null {
  try {
    // Parse ISO 8601 string directly
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;

    // Extract UTC components
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1, // Months are 0-indexed
      day: date.getUTCDate(),
      hours: date.getUTCHours(),
      minutes: date.getUTCMinutes(),
      seconds: date.getUTCSeconds(),
    };
  } catch (error) {
    console.error("Error parsing date:", error);
    return null;
  }
}

/**
 * Format date components according to the specified format string.
 * Supported format tokens:
 * - DD: Day with leading zero
 * - MM: Month with leading zero
 * - YYYY: 4-digit year
 * - HH: Hours with leading zero (24-hour)
 * - mm: Minutes with leading zero
 * - ss: Seconds with leading zero
 */
function formatDateString(components: { year: number; month: number; day: number; hours: number; minutes: number; seconds: number }, format: string): string {
  const { year, month, day, hours, minutes, seconds } = components;

  return format
    .replace("YYYY", year.toString())
    .replace("MM", padZero(month))
    .replace("DD", padZero(day))
    .replace("HH", padZero(hours))
    .replace("mm", padZero(minutes))
    .replace("ss", padZero(seconds));
}

/**
 * Pad a number with leading zero if needed.
 */
function padZero(num: number): string {
  return num.toString().padStart(2, "0");
}

/**
 * Format a date as relative time (e.g., "2 days ago").
 * Deterministic implementation that avoids locale-sensitive APIs.
 * @param date - ISO 8601 date string in UTC
 * @param t - Optional translation function from next-intl useTranslations
 * @returns Formatted relative time string or "—" if date is null/undefined
 */
export function formatTimeAgo(date: string | null, t?: (key: string, values?: Record<string, string | number | Date>) => string): string {
  if (!date) return "—";

  try {
    const parsedDate = parseUTCDate(date);
    if (!parsedDate) return "—";

    const now = new Date();
    const then = new Date(
      Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day, parsedDate.hours, parsedDate.minutes, parsedDate.seconds)
    );
    const diffMs = now.getTime() - then.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (t) {
      // Use translations if provided
      if (diffSeconds < 60) {
        return t("justNow");
      } else if (diffMinutes < 60) {
        return t("minutes", { count: diffMinutes });
      } else if (diffHours < 24) {
        return t("hours", { count: diffHours });
      } else if (diffDays < 30) {
        return t("days", { count: diffDays });
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return t("months", { count: months });
      } else {
        const years = Math.floor(diffDays / 365);
        return t("years", { count: years });
      }
    } else {
      // Fallback to English if no translation function provided
      if (diffSeconds < 60) {
        return "just now";
      } else if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      } else if (diffDays < 30) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months !== 1 ? 's' : ''} ago`;
      } else {
        const years = Math.floor(diffDays / 365);
        return `${years} year${years !== 1 ? 's' : ''} ago`;
      }
    }
  } catch (error) {
    console.error("Error formatting time ago:", error);
    return "—";
  }
}
