"use server";

import {
  createWidget,
  editWidget,
  getAllWidgets,
  getWidgetById,
  getWidgetUsersForSelect,
  deleteWidget,
  deleteWidgetsBulk,
  toggleWidgetActive,
  toggleWidgetsBulk,
} from "../services/widget.services";
import {
  convertCreateWidgetDto,
  convertEditWidgetDto,
  WidgetDetails,
  WidgetFiltersDto,
  WidgetUsersForSelectQuery,
  WidgetUsersForSelectResponse,
  WidgetsResponse,
} from "../types/widget.types";
import type { ServiceResponse } from "@/lib/api-responses";
import { createWidgetSchema } from "../../form/create/schemas/create-widget-schema";
import { editWidgetSchema } from "../../form/edit/schemas/edit-widget-schema";

const SERVER_VALIDATION_MESSAGES = {
  nameRequired: "NAME_REQUIRED",
  nameTooLong: "NAME_TOO_LONG",
  descriptionTooLong: "DESCRIPTION_TOO_LONG",
  typeInvalid: "TYPE_INVALID",
};

function validationError(issues: { path: PropertyKey[]; message: string }[]): ServiceResponse<never> {
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Invalid widget data",
      details: {
        issues: issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          code: issue.message,
        })),
      },
    },
  };
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getAllWidgetsAction(
  options: WidgetFiltersDto = {},
): Promise<WidgetsResponse> {
  return await getAllWidgets(options);
}

export async function getWidgetByIdAction(
  id: string,
): Promise<ServiceResponse<WidgetDetails>> {
  return await getWidgetById(id);
}

export async function getWidgetUsersForSelectAction(
  query: WidgetUsersForSelectQuery = {},
): Promise<ServiceResponse<WidgetUsersForSelectResponse>> {
  return await getWidgetUsersForSelect(query);
}

export async function createWidgetAction(
  input: unknown,
): Promise<ServiceResponse<WidgetDetails>> {
  const parsed = createWidgetSchema(SERVER_VALIDATION_MESSAGES).safeParse(input);
  if (!parsed.success) return validationError(parsed.error.issues);
  return await createWidget(convertCreateWidgetDto(parsed.data));
}

export async function editWidgetAction(
  widgetId: string,
  input: unknown,
): Promise<ServiceResponse<WidgetDetails>> {
  const parsed = editWidgetSchema(SERVER_VALIDATION_MESSAGES).safeParse(input);
  if (!parsed.success) return validationError(parsed.error.issues);
  return await editWidget(widgetId, convertEditWidgetDto(parsed.data));
}

export async function deleteWidgetAction(
  id: string,
): Promise<ServiceResponse<void>> {
  return await deleteWidget(id);
}

export async function deleteWidgetsBulkAction(
  ids: string[],
): Promise<ServiceResponse<{ deleted: number; failed: string[] }>> {
  return await deleteWidgetsBulk(ids);
}

export async function toggleWidgetActiveAction(
  id: string,
  isActive: boolean,
): Promise<ServiceResponse<WidgetDetails>> {
  return await toggleWidgetActive(id, isActive);
}

export async function toggleWidgetsBulkAction(
  ids: string[],
  isActive: boolean,
): Promise<ServiceResponse<{ updated: number; failed: string[] }>> {
  return await toggleWidgetsBulk(ids, isActive);
}
