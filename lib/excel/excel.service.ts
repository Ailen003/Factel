import ExcelJS from "exceljs";
import { ExcelGenerateOptions, ExcelMetadata } from "./types";

const DEFAULT_HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: "FFFFFFFF" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } },
  alignment: { vertical: "middle", horizontal: "center" },
  border: {
    bottom: { style: "thin", color: { argb: "FF000000" } },
  },
};

const DEFAULT_EXCLUDE_KEYS = ["page", "limit", "sortBy", "sortOrder"];

function addMetadataToSheet(
  worksheet: ExcelJS.Worksheet,
  metadata: ExcelMetadata,
  startRow: number,
): number {
  let currentRow = startRow;

  // Title
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = metadata.title;
  titleCell.font = { size: 14, bold: true, color: { argb: "FF2C3E50" } };
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
  currentRow += 1;

  // Generated date
  const dateCell = worksheet.getCell(`A${currentRow}`);
  dateCell.value = `Generated: ${metadata.generatedAt.toLocaleString()}`;
  dateCell.font = { size: 10, italic: true, color: { argb: "FF7F8C8D" } };
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
  currentRow += 1;

  // Applied filters section
  if (metadata.filters && Object.keys(metadata.filters).length > 0) {
    const keysToExclude = [
      ...DEFAULT_EXCLUDE_KEYS,
      ...(metadata.excludeKeys || []),
    ];
    const activeFilters = Object.entries(metadata.filters).filter(
      ([key, value]) =>
        !keysToExclude.includes(key) &&
        value !== undefined &&
        value !== null &&
        value !== "",
    );

    if (activeFilters.length > 0) {
      const filtersCell = worksheet.getCell(`A${currentRow}`);
      filtersCell.value = "Filters: ";
      filtersCell.font = { size: 10, bold: true };

      const filtersText = activeFilters
        .map(
          ([key, value]) =>
            `${formatFilterKey(key)}: ${formatFilterValue(value)}`,
        )
        .join(" | ");

      const filtersValueCell = worksheet.getCell(`B${currentRow}`);
      filtersValueCell.value = filtersText;
      filtersValueCell.font = { size: 10 };
      currentRow += 1;
    }
  }

  currentRow += 1; // Empty row separator

  return currentRow;
}

function formatFilterKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatFilterValue(value: any): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

export async function generateExcelBuffer(
  options: ExcelGenerateOptions,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.creator || "App Name";
  workbook.created = new Date();

  for (const sheetConfig of options.sheets) {
    const worksheet = workbook.addWorksheet(sheetConfig.sheetName);

    let dataStartRow = 1;

    // Add metadata at the top if provided
    if (options.metadata) {
      dataStartRow = addMetadataToSheet(worksheet, options.metadata, 1);
    }

    // Set column widths only (no headers yet)
    sheetConfig.columns.forEach((col, index) => {
      const column = worksheet.getColumn(index + 1);
      column.width = col.width || 20;
      if (col.style) {
        column.style = col.style;
      }
    });

    // Add header row at dataStartRow
    const headerRow = worksheet.getRow(dataStartRow);
    sheetConfig.columns.forEach((col, index) => {
      headerRow.getCell(index + 1).value = col.header;
    });

    // Style header row
    const headerStyle = sheetConfig.headerStyle || DEFAULT_HEADER_STYLE;
    headerRow.eachCell((cell) => {
      if (headerStyle.font) cell.font = headerStyle.font;
      if (headerStyle.fill) cell.fill = headerStyle.fill as ExcelJS.Fill;
      if (headerStyle.alignment) cell.alignment = headerStyle.alignment;
      if (headerStyle.border) cell.border = headerStyle.border;
    });

    // Add data rows
    for (const row of sheetConfig.data) {
      const rowValues = sheetConfig.columns.map((col) => col.accessor(row));
      worksheet.addRow(rowValues);
    }

    // Auto-filter on the header row
    if (sheetConfig.data.length > 0) {
      worksheet.autoFilter = {
        from: { row: dataStartRow, column: 1 },
        to: { row: dataStartRow, column: sheetConfig.columns.length },
      };
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
