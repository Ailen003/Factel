import "server-only";

import type { ServiceResponse } from "@/lib/api-responses";
import { widgetApiRoutes } from "../api/routes/widget-api.routes";
import type { WidgetDetails } from "../types/widget.types";

function failure<T>(code: string, message: string): ServiceResponse<T> {
  return { success: false, error: { code, message } };
}

function getWidgetApiBaseUrl(): string | null {
  const value = process.env.WIDGET_API_BASE_URL?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return value.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

async function requestWidgetApiJson<T>(
  pathname: string,
): Promise<ServiceResponse<T>> {
  const baseUrl = getWidgetApiBaseUrl();
  if (!baseUrl) {
    return failure(
      "CONFIGURATION_ERROR",
      "WIDGET_API_BASE_URL is missing or invalid",
    );
  }

  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return failure(
        "UPSTREAM_ERROR",
        `widget-api returned HTTP ${response.status}`,
      );
    }

    return { success: true, data: (await response.json()) as T };
  } catch (error) {
    return failure(
      "UPSTREAM_ERROR",
      `Unable to fetch widget-api: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}

// ─── Queries ────────────────────────────────────────────────────────────────

export async function getRemoteWidgets(): Promise<
  ServiceResponse<WidgetDetails[]>
> {
  return requestWidgetApiJson<WidgetDetails[]>(widgetApiRoutes.widgets.list);
}

export async function getRemoteWidgetById(
  id: string,
): Promise<ServiceResponse<WidgetDetails>> {
  return requestWidgetApiJson<WidgetDetails>(
    widgetApiRoutes.widgets.getById(id),
  );
}
