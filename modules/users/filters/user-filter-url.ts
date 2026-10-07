import type { UserFiltersDto } from "../lib/types/user.types";

export interface UserFilterState {
  search: string;
  role: "" | "platform_admin" | "trial_user";
  status: "" | "active" | "suspended";
  sortBy: UserFiltersDto["sortBy"];
  sortOrder: UserFiltersDto["sortOrder"];
}

export const DEFAULT_USER_FILTERS: UserFilterState = {
  search: "",
  role: "",
  status: "",
  sortBy: "createdAt",
  sortOrder: "desc",
};

export function readUserFilters(searchParams: URLSearchParams): UserFilterState {
  const role = searchParams.get("role");
  const status = searchParams.get("status");
  const sortBy = searchParams.get("sortBy");
  const sortOrder = searchParams.get("sortOrder");
  return {
    search: searchParams.get("search") ?? "",
    role: role === "platform_admin" || role === "trial_user" ? role : "",
    status: status === "active" || status === "suspended" ? status : "",
    sortBy: ["fullName", "email", "role", "status", "createdAt"].includes(sortBy ?? "")
      ? (sortBy as UserFilterState["sortBy"])
      : "createdAt",
    sortOrder: sortOrder === "asc" ? "asc" : "desc",
  };
}

export function userFiltersToDto(filters: UserFilterState): Omit<UserFiltersDto, "page" | "limit"> {
  return {
    search: filters.search || undefined,
    role: filters.role || undefined,
    status: filters.status || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  };
}

export function writeUserFilters(
  current: URLSearchParams,
  filters: UserFilterState,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const values = userFiltersToDto(filters);
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) next.delete(key);
    else next.set(key, String(value));
  });
  next.set("page", "1");
  return next;
}
