import "server-only";

import type { ServiceResponse } from "@/lib/api-responses";
import {
  queryCollection,
  createRecord,
  updateRecord,
  deleteRecord,
  findById,
} from "@/lib/mock/in-memory-store";
import {
  CreateWidgetDto,
  EditWidgetDto,
  Widget,
  WidgetDetails,
  WidgetFiltersDto,
  WidgetUserOption,
  WidgetUsersForSelectQuery,
  WidgetUsersForSelectResponse,
  WidgetsResponse,
} from "../types/widget.types";
import { widgetsStore } from "../mock/widgets.data";

const MOCK_ACTOR_ID = "mock-user-id-001";
const MOCK_ACTOR_INFO = {
  id: MOCK_ACTOR_ID,
  full_name: "Template Admin",
  email: "admin@template.dev",
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getAllWidgets(
  filters: WidgetFiltersDto = {},
): Promise<WidgetsResponse> {
  const { rows, pagination } = queryCollection({
    data: widgetsStore as unknown as Record<string, unknown>[],
    page: filters.page ?? 1,
    limit: filters.limit ?? 10,
    search: filters.search,
    searchFields: ["name", "description"],
    filters: {
      isActive: filters.isActive,
      createdBy: filters.createdBy,
    },
    sortBy: filters.sortBy ?? "name",
    sortOrder: filters.sortOrder ?? "asc",
  });

  return {
    widgets: rows as unknown as Widget[],
    pagination,
  };
}

export async function getWidgetUsersForSelect(
  query: WidgetUsersForSelectQuery = {},
): Promise<ServiceResponse<WidgetUsersForSelectResponse>> {
  const page = Number.isSafeInteger(query.page) && query.page && query.page > 0 ? query.page : 1;
  const limit = Number.isSafeInteger(query.limit) && query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 25;
  const search = query.search?.trim().toLowerCase();

  try {
    const users = new Map<string, WidgetUserOption>();
    widgetsStore.forEach((widget) => {
      if (widget.createdByUser) {
        users.set(widget.createdByUser.id, {
          id: widget.createdByUser.id,
          label: widget.createdByUser.full_name,
        });
      }
    });
    const filteredUsers = [...users.values()].filter(
      (user) => !search || user.label.toLowerCase().includes(search),
    );
    const total = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * limit;
    return {
      success: true,
      data: {
        users: filteredUsers.slice(start, start + limit),
        pagination: { page: currentPage, limit, total, totalPages },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: `Failed to get widget users: ${error}`,
      },
    };
  }
}

export async function getWidgetById(
  id: string,
): Promise<ServiceResponse<WidgetDetails>> {
  try {
    const record = findById(widgetsStore, id);
    if (!record) {
      return { success: false, error: { code: "NOT_FOUND", message: "Widget not found" } };
    }
    return { success: true, data: record };
  } catch (error) {
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: `Failed to get widget: ${error}` },
    };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createWidget(
  dto: CreateWidgetDto,
): Promise<ServiceResponse<WidgetDetails>> {
  try {
    const now = new Date().toISOString();
    const record: Widget = {
      id: crypto.randomUUID(),
      name: dto.name,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
      type: dto.type ?? "type_a",
      createdBy: MOCK_ACTOR_ID,
      createdAt: now,
      updatedBy: null,
      updatedAt: now,
      createdByUser: MOCK_ACTOR_INFO,
      updatedByUser: null,
    };
    const created = createRecord(widgetsStore, record);
    return { success: true, data: created };
  } catch (error) {
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: `Failed to create widget: ${error}` },
    };
  }
}

export async function editWidget(
  id: string,
  dto: EditWidgetDto,
): Promise<ServiceResponse<WidgetDetails>> {
  try {
    const existing = findById(widgetsStore, id);
    if (!existing) {
      return { success: false, error: { code: "NOT_FOUND", message: "Widget not found" } };
    }

    const patch: Partial<Widget> = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.type !== undefined && { type: dto.type }),
      updatedBy: MOCK_ACTOR_ID,
      updatedAt: new Date().toISOString(),
      updatedByUser: MOCK_ACTOR_INFO,
    };

    const updated = updateRecord(widgetsStore, id, patch);
    if (!updated) {
      return { success: false, error: { code: "NOT_FOUND", message: "Widget not found" } };
    }
    return { success: true, data: updated };
  } catch (error) {
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: `Failed to edit widget: ${error}` },
    };
  }
}

export async function toggleWidgetActive(
  id: string,
  isActive: boolean,
): Promise<ServiceResponse<WidgetDetails>> {
  try {
    const updated = updateRecord(widgetsStore, id, {
      isActive,
      updatedBy: MOCK_ACTOR_ID,
      updatedAt: new Date().toISOString(),
      updatedByUser: MOCK_ACTOR_INFO,
    });
    if (!updated) {
      return { success: false, error: { code: "NOT_FOUND", message: "Widget not found" } };
    }
    return { success: true, data: updated };
  } catch (error) {
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: `Failed to toggle widget: ${error}` },
    };
  }
}

export async function deleteWidget(
  id: string,
): Promise<ServiceResponse<void>> {
  try {
    const deleted = deleteRecord(widgetsStore, id);
    if (!deleted) {
      return { success: false, error: { code: "NOT_FOUND", message: "Widget not found" } };
    }
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: `Failed to delete widget: ${error}` },
    };
  }
}

export async function deleteWidgetsBulk(
  ids: string[],
): Promise<ServiceResponse<{ deleted: number; failed: string[] }>> {
  const failed: string[] = [];
  let deleted = 0;
  for (const id of ids) {
    const ok = deleteRecord(widgetsStore, id);
    if (ok) { deleted++; } else { failed.push(id); }
  }
  return { success: true, data: { deleted, failed } };
}

export async function toggleWidgetsBulk(
  ids: string[],
  isActive: boolean,
): Promise<ServiceResponse<{ updated: number; failed: string[] }>> {
  const failed: string[] = [];
  let updated = 0;
  const now = new Date().toISOString();
  for (const id of ids) {
    const record = updateRecord(widgetsStore, id, {
      isActive,
      updatedBy: MOCK_ACTOR_ID,
      updatedAt: now,
      updatedByUser: MOCK_ACTOR_INFO,
    });
    if (record) { updated++; } else { failed.push(id); }
  }
  return { success: true, data: { updated, failed } };
}
