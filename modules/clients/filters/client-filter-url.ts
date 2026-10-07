import type { ClientFiltersDto } from "../lib/types/client.types";

export interface ClientFilterState {
  search: string;
  sortBy: NonNullable<ClientFiltersDto["sortBy"]>;
  sortOrder: NonNullable<ClientFiltersDto["sortOrder"]>;
}
export const DEFAULT_CLIENT_FILTERS: ClientFilterState = { search: "", sortBy: "createdAt", sortOrder: "desc" };

export function readClientFilters(params: URLSearchParams): ClientFilterState {
  const sortBy = params.get("sortBy");
  return {
    search: params.get("search") ?? "",
    sortBy: sortBy === "name" || sortBy === "email" || sortBy === "company" ? sortBy : "createdAt",
    sortOrder: params.get("sortOrder") === "asc" ? "asc" : "desc",
  };
}

export function clientFiltersToDto(filters: ClientFilterState): Omit<ClientFiltersDto, "page" | "limit"> {
  return { ...filters, search: filters.search || undefined };
}
