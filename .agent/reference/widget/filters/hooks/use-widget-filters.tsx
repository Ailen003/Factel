"use client";

import { Dispatch, SetStateAction, useCallback, useMemo, useState } from "react";
import { convertWidgetFiltersDto, WidgetFilters, WidgetFiltersDto } from "../../lib/types/widget.types";
import useUrlFilters from "@/hooks/use-url-filters";
import { useSearchParams } from "next/navigation";

interface Props {
  setPagination?: Dispatch<SetStateAction<WidgetFiltersDto>>;
  urlFilters?: boolean;
}

export default function useWidgetFilters({ setPagination, urlFilters = true }: Props) {
  const { updateFiltersInUrl } = useUrlFilters({});
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<WidgetFilters>(() => ({
    search: searchParams.get("search") || "",
    isActive: searchParams.get("isActive") === "true" ? true
             : searchParams.get("isActive") === "false" ? false : "",
    createdBy: searchParams.get("createdBy") || "",
    sortBy: searchParams.get("sortBy") || "name",
    sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "asc",
  }));

  const handleChangeFilters = useCallback(
    (updatedFilters: Partial<WidgetFilters>) => {
      setFilters((prev) => {
        const newFilters = { ...prev, ...updatedFilters };
        if (urlFilters) {
          updateFiltersInUrl({ ...convertWidgetFiltersDto(newFilters), page: 1 });
        }
        return newFilters;
      });
      if (setPagination) setPagination((old) => ({ ...old, page: 1 }));
    },
    [urlFilters, updateFiltersInUrl, setPagination],
  );

  const handleResetFilters = useCallback(() => {
    setFilters({ search: "", isActive: "", createdBy: "", sortBy: "name", sortOrder: "asc" });
    if (urlFilters) {
      updateFiltersInUrl({ search: undefined, isActive: undefined, createdBy: undefined, sortBy: "name", sortOrder: "asc", page: 1 });
    }
    if (setPagination) setPagination((old) => ({ ...old, page: 1 }));
  }, [urlFilters, updateFiltersInUrl, setPagination]);

  const getActiveFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.isActive !== "") count++;
    if (filters.createdBy) count++;
    return count;
  }, [filters.search, filters.isActive, filters.createdBy]);

  return { filters, handleChangeFilters, handleResetFilters, getActiveFiltersCount };
}
