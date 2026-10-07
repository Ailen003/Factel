// ─── Domain types ─────────────────────────────────────────────────────────────

export type WidgetType = "type_a" | "type_b";

// ─── Enum Helpers ─────────────────────────────────────────────────────────────

export const widgetTypeConfig: Record<WidgetType, { className: string }> = {
  type_a: { className: "text-blue-600 bg-blue-100" },
  type_b: { className: "text-green-600 bg-green-100" },
};

export const getWidgetTypeInfo = (type: WidgetType) => widgetTypeConfig[type];

// ─── Interfaces de entidad ────────────────────────────────────────────────────

export interface UserInfo {
  id: string;
  full_name: string;
  email: string;
}

export interface WidgetUserOption {
  id: string;
  label: string;
}

export interface WidgetUsersForSelectQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface WidgetUsersForSelectResponse {
  users: WidgetUserOption[];
  pagination: WidgetsResponse["pagination"];
}

export interface Widget {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  type: WidgetType;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  createdByUser: UserInfo | null;
  updatedByUser: UserInfo | null;
}

export type WidgetDetails = Widget;

// ─── Response types ───────────────────────────────────────────────────────────

export interface WidgetsResponse {
  widgets: Widget[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Filter DTOs ──────────────────────────────────────────────────────────────

export interface WidgetFilters {
  search: string;
  isActive: boolean | ""; // "" means no filter
  createdBy: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export interface WidgetFiltersDto {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  isActive?: boolean;
  createdBy?: string;
}

export const convertWidgetFiltersDto = (filters: WidgetFilters): WidgetFiltersDto => ({
  search: filters.search || undefined,
  isActive: filters.isActive !== "" ? filters.isActive : undefined,
  createdBy: filters.createdBy || undefined,
  sortBy: filters.sortBy || undefined,
  sortOrder: filters.sortOrder || undefined,
});

// ─── Create DTO ───────────────────────────────────────────────────────────────

export interface CreateWidgetDto {
  name: string;
  description?: string | null;
  isActive?: boolean;
  type?: WidgetType;
}

export const convertCreateWidgetDto = (schema: {
  name: string;
  description?: string;
  isActive: boolean;
  type: WidgetType;
}): CreateWidgetDto => ({
  name: schema.name,
  description: schema.description || null,
  isActive: schema.isActive,
  type: schema.type,
});

// ─── Edit DTO ─────────────────────────────────────────────────────────────────

export interface EditWidgetDto {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  type?: WidgetType;
}

export const convertEditWidgetDto = (schema: {
  name: string;
  description?: string;
  isActive: boolean;
  type: WidgetType;
}): EditWidgetDto => ({
  name: schema.name,
  description: schema.description || null,
  isActive: schema.isActive,
  type: schema.type,
});
