import { FilenameOptions } from "./types";

const DEFAULT_EXCLUDE_KEYS = ["page", "limit", "sortBy", "sortOrder"];

export function generateReportFilename(options: FilenameOptions): string {
  const {
    baseName,
    filters = {},
    excludeKeys = [],
    dateFormat = "YYYY-MM-DD",
  } = options;

  const parts = [baseName];

  // Combine default and custom exclude keys
  const keysToExclude = [...DEFAULT_EXCLUDE_KEYS, ...excludeKeys];

  // Process all filter properties dynamically
  Object.entries(filters).forEach(([key, value]) => {
    // Skip excluded keys
    if (keysToExclude.includes(key)) {
      return;
    }

    // Skip undefined, null, or empty string values
    if (value === undefined || value === null || value === "") {
      return;
    }

    // Handle boolean values
    if (typeof value === "boolean") {
      parts.push(`${key}-${value ? "enabled" : "disabled"}`);
      return;
    }

    // Handle all other values (string, number, etc.)
    const sanitizedValue = String(value).toLowerCase().replace(/\s+/g, "-");
    parts.push(`${key}-${sanitizedValue}`);
  });

  // Add date
  const date = new Date();
  let dateFormatted = date.toISOString().split("T")[0]; // Default YYYY-MM-DD

  if (dateFormat !== "YYYY-MM-DD") {
    // Handle custom date formats
    dateFormatted = formatDate(date, dateFormat);
  }

  parts.push(dateFormatted);

  return `${parts.join("-")}.xlsx`;
}

function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return format
    .replace("YYYY", String(year))
    .replace("MM", month)
    .replace("DD", day);
}

// Helper function for specific modules
export function createFilenameGenerator(
  baseName: string,
  excludeKeys?: string[],
) {
  return (filters?: Record<string, any>, dateFormat?: string) =>
    generateReportFilename({ baseName, filters, excludeKeys, dateFormat });
}
