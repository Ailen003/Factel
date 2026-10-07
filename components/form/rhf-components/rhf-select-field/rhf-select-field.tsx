"use client";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircleIcon, XIcon, SearchIcon, ArrowUpDownIcon, Loader2 } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useRef, useEffect } from "react";

interface SelectOption {
  label: string;
  value: string;
}

type SortOrder = "asc" | "desc";

interface Props {
  name: string;
  label?: string;
  placeholder?: string;
  description?: string;
  options: SelectOption[];
  fullWidth?: boolean;
  loading?: boolean;
  emptyText?: string;
  clearable?: boolean;
  disabled?: boolean;
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

export function RHFSelectField({
  name,
  label,
  placeholder,
  description,
  options,
  fullWidth = true,
  loading = false,
  emptyText = "No hay datos",
  clearable = false,
  disabled = false,
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
  const { control, setValue } = useFormContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownSide, setDropdownSide] = useState<"top" | "bottom">("bottom");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRegistryRef = useRef<Map<string, SelectOption>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    options.forEach((option) => {
      optionRegistryRef.current.set(option.value, option);
    });
  }, [options]);

  const useClientSearch = searchable && (clientSideSearchFallback || !onSearch);
  const useClientSort = sortable && (clientSideSortFallback || !onSort);

  const determineDropdownSide = () => {
    if (!triggerRef.current) return "bottom";
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    return spaceBelow >= spaceAbove ? "bottom" : "top";
  };

  useEffect(() => {
    if (!searchable || !isOpen) return;
    const id = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen, searchable]);

  useEffect(() => {
    if (!sortable || !onSort) return;
    onSort(sortOrder);
  }, [sortOrder, onSort, sortable]);

  useEffect(() => {
    if (!isOpen || !hasNextPage || !onLoadNextPage) return;

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
  }, [isOpen, hasNextPage, isFetchingNextPage, onLoadNextPage]);

  const handleClear = () => {
    setValue(name, "", { shouldValidate: true });
  };

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

    if (useClientSearch && searchQuery) {
      result = result.filter((option) =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (useClientSort) {
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
    useClientSearch,
    useClientSort,
  ]);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={`${fullWidth ? "w-full" : ""}`}>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <div className="relative">
              <Select
                open={isOpen}
                onOpenChange={(open) => {
                  setIsOpen(open);
                  if (open) {
                    setDropdownSide(determineDropdownSide());
                  }
                  if (!open && !onSearch) {
                    setSearchQuery("");
                  }
                }}
                onValueChange={field.onChange}
                value={field.value}
                disabled={loading || disabled}
              >
                <SelectTrigger
                  ref={triggerRef}
                  aria-label={label}
                  className={`${fullWidth ? "w-full" : ""}`}
                >
                  <SelectValue
                    placeholder={
                      loading ? "Cargando..." : placeholder || "Selecciona"
                    }
                  />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  avoidCollisions={false}
                  side={dropdownSide}
                  sideOffset={4}
                >
                  {(searchable || sortable) && (
                    <div className="sticky top-0 z-10 border-b border-border bg-popover p-2">
                      <div className="flex items-center gap-2">
                        {searchable && (
                          <div className="relative flex-1">
                            <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              ref={searchInputRef}
                              placeholder={searchPlaceholder}
                              value={searchQuery}
                              onChange={(e) => handleSearchChange(e.target.value)}
                              className="h-8 pl-8 pr-2"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                        {sortable && (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSortToggle();
                            }}
                            className="h-8 px-3 text-xs gap-2 whitespace-nowrap"
                          >
                            <ArrowUpDownIcon className="h-3.5 w-3.5" />
                            {sortOrder === "asc" ? "A → Z" : "Z → A"}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} className="max-h-60 overflow-auto py-1">
                    {(() => {
                      const baseOptions = filteredAndSortedOptions;
                      const baseValues = new Set(baseOptions.map((option) => option.value));
                      const selectedValue = field.value as string | undefined;
                      const selectedOption = selectedValue
                        ? optionRegistryRef.current.get(selectedValue)
                        : null;
                      const optionsToRender = selectedOption && !baseValues.has(selectedOption.value)
                        ? [selectedOption, ...baseOptions]
                        : baseOptions;

                      if (optionsToRender.length === 0) {
                        return (
                          <div className="flex gap-2 p-2 text-sm text-muted-foreground">
                            <AlertCircleIcon className="h-4 w-4" />
                            {searchQuery ? "No se encontraron resultados" : emptyText}
                          </div>
                        );
                      }

                      return (
                        <>
                          {optionsToRender.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                          {hasNextPage && (
                            <div className="text-center py-2">
                              {isFetchingNextPage ? (
                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Cargar más…
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </SelectContent>
              </Select>
              {clearable && field.value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-8 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Clear selection"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
