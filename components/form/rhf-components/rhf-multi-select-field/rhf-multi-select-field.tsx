"use client";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useFormContext } from "react-hook-form";

import { AlertCircleIcon, SearchIcon, ArrowUpDownIcon, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect, useRef } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";


interface SelectOption {
  label: string;
  value: string;
}

type SortOrder = "asc" | "desc";

interface Props {
  name: string;
  label?: string;
  description?: string;
  options: SelectOption[];
  columns?: number;
  maxHeight?: string;
  loading?: boolean;
  emptyText?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  sortable?: boolean;
  onSort?: (order: SortOrder) => void;
  clientSideSearchFallback?: boolean;
  clientSideSortFallback?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadNextPage?: () => void;
}
const columnClasses: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

export function RHFMultiSelectField({
  name,
  label,
  description,
  options,
  columns = 2,
  maxHeight = "max-h-60",
  loading = false,
  emptyText = "No hay datos",
  searchable = false,
  searchPlaceholder = "Buscar...",
  onSearch,
  sortable = false,
  onSort,
  clientSideSearchFallback = false,
  clientSideSortFallback = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadNextPage,
}: Props) {
  const { control } = useFormContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const optionRegistryRef = useRef<Map<string, SelectOption>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    options.forEach((option) => {
      optionRegistryRef.current.set(option.value, option);
    });
  }, [options]);

  useEffect(() => {
    if (!sortable || !onSort) return;
    onSort(sortOrder);
  }, [sortOrder, onSort, sortable]);

  useEffect(() => {
    if (!hasNextPage || !onLoadNextPage) return;

    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      if (loadingRef.current || isFetchingNextPage) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const isBottom = scrollTop + clientHeight >= scrollHeight - 10;

      if (isBottom) {
        loadingRef.current = true;
        onLoadNextPage();

        setTimeout(() => {
          loadingRef.current = false;
        }, 300);
      }
    };

    scrollEl.addEventListener("scroll", handleScroll);

    return () => {
      scrollEl.removeEventListener("scroll", handleScroll);
    };
  }, [hasNextPage, isFetchingNextPage, onLoadNextPage]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleSortToggle = () => {
    const nextOrder: SortOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(nextOrder);
    if (onSort) {
      onSort(nextOrder);
    }
  };

  const filteredAndSortedOptions = useMemo(() => {
    let result = [...options];

    if (searchable && (!onSearch || clientSideSearchFallback) && searchQuery) {
      result = result.filter((option) =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (sortable && (!onSort || clientSideSortFallback)) {
      result.sort((a, b) => {
        const comparison = a.label.localeCompare(b.label);
        return sortOrder === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [
    options,
    searchQuery,
    sortOrder,
    searchable,
    onSearch,
    sortable,
    onSort,
    clientSideSearchFallback,
    clientSideSortFallback,
  ]);

  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => {
        const handleCheckboxChange = (checked: boolean, value: string) => {
          const current = new Set(field.value || []);
          if (checked) {
            current.add(value);
          } else {
            current.delete(value);
          }
          field.onChange(Array.from(current));
        };

        return (
          <FormItem>
            {label && <FormLabel>{label}</FormLabel>}
            <FormControl>
              {!loading ? (
                <div className="space-y-4 rounded-2xl border bg-card/40 p-4 shadow-sm">
                  {(searchable || sortable) && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      {searchable && (
                        <div className="relative flex-1">
                          <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="border-muted bg-background pl-9 pr-3 text-sm shadow-sm"
                          />
                        </div>
                      )}
                      {sortable && (
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={handleSortToggle}
                          className="gap-2  border-muted text-xs font-semibold uppercase tracking-wide"
                        >
                          <ArrowUpDownIcon className="h-4 w-4" />
                          {sortOrder === "asc" ? "A → Z" : "Z → A"}
                        </Button>
                      )}
                    </div>
                  )}
                  {(() => {
                    const baseOptions =
                      (onSearch && !clientSideSearchFallback) || (onSort && !clientSideSortFallback)
                        ? options
                        : filteredAndSortedOptions;
                    const baseValues = new Set(baseOptions.map((option) => option.value));
                    const selectedValues: string[] = Array.isArray(field.value)
                      ? field.value
                      : [];
                    const selectedOptions = selectedValues
                      .map((value) => optionRegistryRef.current.get(value))
                      .filter((option): option is SelectOption => Boolean(option));
                    const missingSelectedOptions = selectedOptions.filter(
                      (option) => !baseValues.has(option.value)
                    );
                    const optionsToRender = [...missingSelectedOptions, ...baseOptions];

                    if (optionsToRender.length === 0) {
                      return (
                        <div className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                          <AlertCircleIcon className="h-4 w-4" />
                          {searchQuery ? "No se encontraron resultados" : emptyText}
                        </div>
                      );
                    }

                    return (
                      <div
                        ref={scrollRef}
                        className={cn(
                          "grid gap-2 overflow-y-auto p-4 pt-2",
                          columnClasses[columns],
                          maxHeight
                        )}
                      >
                        {optionsToRender.map((option) => {
                          const isChecked = field.value?.includes(option.value);
                          return (
                            <FormItem key={`${name}-${option.value}`} className="space-y-0">
                              <label
                                htmlFor={`${name}-${option.value}`}
                                className={cn(
                                  "flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left text-sm transition focus-within:ring-2 focus-within:ring-primary/30",
                                  isChecked
                                    ? "border-primary/60 bg-primary/5 shadow-sm"
                                    : "border-muted bg-background hover:border-primary/40 hover:bg-muted/40"
                                )}
                              >
                                <Checkbox
                                  id={`${name}-${option.value}`}
                                  checked={isChecked}
                                  onCheckedChange={(checked) =>
                                    handleCheckboxChange(!!checked, option.value)
                                  }
                                  className="mt-0.5"
                                />
                                <span className="flex-1 text-sm font-medium leading-snug text-foreground">
                                  {option.label}
                                </span>
                              </label>
                            </FormItem>
                          );
                        })}
                        {hasNextPage && (
                          <div className="col-span-full text-center py-2">
                            {isFetchingNextPage ? (
                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Cargar más…
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="mx-auto">
                  <LoadingSpinner />
                </div>
              )}
            </FormControl>
            {description && options.length > 0 && (
              <FormDescription>{description}</FormDescription>
            )}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
