import type ExcelJS from "exceljs";

// ─── Column Definition ──────────────────────────────────────────────────────────

export interface ExcelColumnDef<T = any> {
  header: string;
  key: string;
  accessor: (row: T) => any;
  width?: number;
  style?: Partial<ExcelJS.Style>;
}

// ─── Sheet Configuration ─────────────────────────────────────────────────────────

export interface ExcelSheetConfig<T = any> {
  sheetName: string;
  columns: ExcelColumnDef<T>[];
  data: T[];
  headerStyle?: Partial<ExcelJS.Style>;
}

// ─── Workbook Generation Options ─────────────────────────────────────────────────

export interface ExcelMetadata {
  title: string;
  generatedAt: Date;
  filters?: Record<string, any>;
  excludeKeys?: string[];
}

export interface ExcelGenerateOptions {
  filename: string;
  creator?: string;
  sheets: ExcelSheetConfig[];
  metadata?: ExcelMetadata;
}

// ─── Report Result ───────────────────────────────────────────────────────────────

export interface ReportResult {
  success: true;
  downloadUrl: string;
  filename: string;
}

export interface ReportError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ReportResponse = ReportResult | ReportError;

// ─── Generic Filter Interface ─────────────────────────────────────────────────────

export interface ReportFilters {
  search?: string;
  [key: string]: any; // Allow module-specific filters
}

// ─── Filename Generation Options ─────────────────────────────────────────────────

export interface FilenameOptions {
  baseName: string;
  filters?: Record<string, any>;
  excludeKeys?: string[]; // Keys to exclude from filename generation
  dateFormat?: string; // Default: YYYY-MM-DD
}
