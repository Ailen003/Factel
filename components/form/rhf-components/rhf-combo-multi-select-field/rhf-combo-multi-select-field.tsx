"use client";
import { useState, useMemo, useRef, useEffect, useId } from "react";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { AlertCircleIcon, ChevronDownIcon, XIcon, SearchIcon, ArrowUpDownIcon, Loader2 } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SelectOption {
  label: string;
  value: string;
}

type SortOrder = "asc" | "desc";

let scrollLockCounter = 0;
let previousOverflow: string | null = null;

const lockBodyScroll = () => {
  if (typeof document === "undefined") return;
  scrollLockCounter += 1;
  if (scrollLockCounter === 1) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
};

const unlockBodyScroll = () => {
  if (typeof document === "undefined") return;
  scrollLockCounter = Math.max(0, scrollLockCounter - 1);
  if (scrollLockCounter === 0 && previousOverflow !== null) {
    document.body.style.overflow = previousOverflow;
    previousOverflow = null;
  }
};

interface Props {
  name: string;
  label?: string;
  placeholder?: string;
  description?: string;
  options: SelectOption[];
  fullWidth?: boolean;
  loading?: boolean;
  emptyText?: string;
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

export function RHFComboMultiSelectField({
  name,
  label,
  placeholder,
  description,
  options,
  fullWidth = true,
  loading = false,
  emptyText = "No hay datos",
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
  const { control } = useFormContext();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [dropdownSide, setDropdownSide] = useState<"top" | "bottom">("bottom");
  const [optionRegistry, setOptionRegistry] = useState<Map<string, SelectOption>>(
    () => new Map()
  );
  const listboxId = useId();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLUListElement>(null);
  const loadingRef = useRef(false);

  const currentOptionsMap = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options]
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setOptionRegistry((previous) => {
        const next = new Map(previous);
        options.forEach((option) => {
          next.set(option.value, option);
        });
        return next;
      });
    }, 0);
    return () => clearTimeout(timeoutId);
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
    if (!searchable || !open) return;
    const id = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [open]);

  useEffect(() => {
    if (!sortable || !onSort) return;
    onSort(sortOrder);
  }, [sortOrder, onSort, sortable]);

  useEffect(() => {
    if (!open || !hasNextPage || !onLoadNextPage) return;

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
  }, [open, hasNextPage, isFetchingNextPage, onLoadNextPage]);

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
  }, [options, searchQuery, sortOrder, useClientSearch, useClientSort]);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selected: string[] = field.value ?? [];

        const toggleOption = (value: string) => {
          const next = selected.includes(value)
            ? selected.filter((v) => v !== value)
            : [...selected, value];
          field.onChange(next);
        };

        const removeOption = (value: string, e: React.MouseEvent) => {
          e.stopPropagation();
          field.onChange(selected.filter((v) => v !== value));
        };

        const selectedLabels = selected
          .map((value) => currentOptionsMap.get(value) ?? optionRegistry.get(value))
          .filter((option): option is SelectOption => Boolean(option));

        return (
          <FormItem className={fullWidth ? "w-full" : ""}>
            {label && <FormLabel>{label}</FormLabel>}
            <FormControl>
              <Popover
                open={open}
                onOpenChange={(nextOpen) => {
                  setOpen(nextOpen);
                  if (nextOpen) {
                    setDropdownSide(determineDropdownSide());
                  }
                  if (!nextOpen && !onSearch) {
                    setSearchQuery("");
                  }
                }}
              >
                <PopoverTrigger asChild disabled={loading || disabled}>
                  <button
                    type="button"
                    role="combobox"
                    aria-controls={listboxId}
                    aria-expanded={open}
                    ref={triggerRef}
                    className={cn(
                      "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      !fullWidth && "w-auto"
                    )}
                  >
                    {selectedLabels.length > 0 ? (
                      <>
                        {selectedLabels.map((opt) => (
                          <Badge
                            key={opt.value}
                            variant="secondary"
                            className="flex items-center gap-1 pr-1"
                          >
                            {opt.label}
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => removeOption(opt.value, e)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  field.onChange(selected.filter((v) => v !== opt.value));
                                }
                              }}
                              className="ml-0.5 cursor-pointer rounded-sm hover:bg-muted-foreground/20"
                            >
                              <XIcon className="h-3 w-3" />
                            </span>
                          </Badge>
                        ))}
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        {loading ? "Cargando..." : placeholder ?? "Selecciona"}
                      </span>
                    )}
                    <ChevronDownIcon className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0"
                  style={{ width: "var(--radix-popover-trigger-width)" }}
                  align="start"
                  side={dropdownSide}
                  sideOffset={4}
                  avoidCollisions={false}
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
                  {(() => {
                    const baseOptions = filteredAndSortedOptions;
                    const baseValues = new Set(baseOptions.map((option) => option.value));
                    const selectedOptions = selected
                      .map((value) => currentOptionsMap.get(value) ?? optionRegistry.get(value))
                      .filter((option): option is SelectOption => Boolean(option));
                    const missingSelectedOptions = selectedOptions.filter(
                      (option) => !baseValues.has(option.value)
                    );
                    const optionsToRender = [...missingSelectedOptions, ...baseOptions];

                    if (optionsToRender.length === 0) {
                      return (
                        <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                          <AlertCircleIcon className="h-4 w-4" />
                          {searchQuery ? "No se encontraron resultados" : emptyText}
                        </div>
                      );
                    }

                    return (
                      <ul id={listboxId} ref={scrollRef} role="listbox" className="max-h-60 overflow-y-auto p-1">
                        {optionsToRender.map((option) => {
                          const isSelected = selected.includes(option.value);
                          return (
                            <li
                              key={option.value}
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => toggleOption(option.value)}
                              className={cn(
                                "flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm outline-none",
                                "hover:bg-accent hover:text-accent-foreground",
                                isSelected && "bg-accent/50 font-medium"
                              )}
                            >
                              <span
                                className={cn(
                                  "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "opacity-50"
                                )}
                              >
                                {isSelected && (
                                  <svg
                                    className="h-3 w-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                )}
                              </span>
                              {option.label}
                            </li>
                          );
                        })}
                        {hasNextPage && (
                          <li className="text-center py-2">
                            {isFetchingNextPage ? (
                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Cargar más…
                              </span>
                            )}
                          </li>
                        )}
                      </ul>
                    );
                  })()}
                </PopoverContent>
              </Popover>
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
