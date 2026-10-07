// ─── In-Memory Store ──────────────────────────────────────────────────────────
// Generic helper for filtering, searching, sorting and paginating an in-memory
// data array. Used by demo services that still run with representative data.
// Replace the service internals (not this helper) when wiring a real database.

export interface QueryOptions<T> {
  data: T[];
  page?: number | string;
  limit?: number | string;
  search?: string;
  searchFields?: (keyof T)[];
  filters?: Partial<Record<keyof T, unknown>>;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  sortMap?: Record<string, keyof T>;
}

export interface QueryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface QueryResult<T> {
  rows: T[];
  pagination: QueryPagination;
}

export function queryCollection<T extends Record<string, unknown>>(
  options: QueryOptions<T>,
): QueryResult<T> {
  const {
    data,
    page = 1,
    limit = 10,
    search,
    searchFields = [],
    filters = {},
    sortBy,
    sortOrder = "asc",
    sortMap = {},
  } = options;

  let result = [...data];

  // Apply exact-match filters (skip undefined/null values = no filter)
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    result = result.filter((item) => item[key as keyof T] === value);
  }

  // Apply text search across specified fields
  if (search && searchFields.length > 0) {
    const term = search.toLowerCase();
    result = result.filter((item) =>
      searchFields.some((field) => {
        const val = item[field];
        return typeof val === "string" && val.toLowerCase().includes(term);
      }),
    );
  }

  // Sort
  if (sortBy) {
    const sortKey = (sortMap[sortBy] ?? sortBy) as keyof T;
    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }

  // Paginate
  const total = result.length;
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const from = (pageNum - 1) * limitNum;
  const rows = result.slice(from, from + limitNum);

  return {
    rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    },
  };
}

// ─── CRUD helpers ─────────────────────────────────────────────────────────────
// Lightweight utilities for mutating an in-memory array (create / update / delete).
// Pass the live store array by reference; helpers return the mutated array entry.

export function createRecord<T extends { id: string }>(
  store: T[],
  record: T,
): T {
  store.push(record);
  return record;
}

export function updateRecord<T extends { id: string }>(
  store: T[],
  id: string,
  patch: Partial<T>,
): T | null {
  const idx = store.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  store[idx] = { ...store[idx], ...patch };
  return store[idx];
}

export function deleteRecord<T extends { id: string }>(
  store: T[],
  id: string,
): boolean {
  const idx = store.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  store.splice(idx, 1);
  return true;
}

export function findById<T extends { id: string }>(
  store: T[],
  id: string,
): T | null {
  return store.find((r) => r.id === id) ?? null;
}
