"use client";
import { Label } from "@/components/ui/label";
import type React from "react";
import { Input } from "@/components/ui/input";
import {
  Search,
  ArrowDownAZ,
  ArrowUpZA,
  Loader2,
  XIcon,
  AlertCircleIcon,
  ChevronDownIcon,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface Option {
  label: string;
  value: string;
}

interface MultiSelectInputProps {
  label?: string;
  placeholder?: string;
  value?: string[];
  onValueChange?: (value: string[]) => void;
  options: Option[];
  loading?: boolean;
  clearable?: {
    handleClear: () => void;
  };
  fullWidth?: boolean;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterPlaceholder?: string;
  sortDirection?: "ASC" | "DESC";
  onSortChange?: (d: "ASC" | "DESC") => void;
  emptyText?: string;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadNextPage?: () => void;
  labelVariant?: "default" | "inside";
}

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

export default function MultiSelectInput({
  label,
  placeholder = "Selecciona elementos",
  value = [],
  onValueChange,
  options,
  loading = false,
  clearable,
  fullWidth = true,
  filterValue,
  onFilterChange,
  filterPlaceholder = "Buscar...",
  sortDirection = "ASC",
  onSortChange,
  emptyText = "No hay datos",
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadNextPage,
  labelVariant = "default",
}: MultiSelectInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownSide, setDropdownSide] = useState<"top" | "bottom">("bottom");
  const optionRegistry = useMemo(() => {
    const registry = new Map<string, Option>();
    options.forEach((option) => {
      registry.set(option.value, option);
    });
    return registry;
  }, [options]);
  const loadingRef = useRef(false);

  const determineDropdownSide = () => {
    if (!triggerRef.current) return "bottom";
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    return spaceBelow >= spaceAbove ? "bottom" : "top";
  };

  useEffect(() => {
    if (isOpen && onFilterChange) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, onFilterChange]);

  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isOpen]);

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

  const filteredOptions = onFilterChange
    ? options
    : options.filter((opt) =>
        opt.label.toLowerCase().includes((filterValue || "").toLowerCase())
      );

  const sortedOptions = onSortChange
    ? filteredOptions
    : [...filteredOptions].sort((a, b) =>
        sortDirection === "ASC"
          ? a.label.localeCompare(b.label)
          : b.label.localeCompare(a.label)
      );

  const handleSortToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSortChange?.(sortDirection === "ASC" ? "DESC" : "ASC");
  };

  const toggleOption = (optionValue: string) => {
    if (!onValueChange) return;
    const next = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onValueChange(next);
  };

  const removeOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onValueChange) return;
    onValueChange(value.filter((v) => v !== optionValue));
  };

  const selectedLabels = useMemo(() => {
    return value
      .map((val) => optionRegistry.get(val))
      .filter((option): option is Option => Boolean(option));
  }, [value, optionRegistry]);

  const showClearButton = clearable && value.length > 0;

  const baseValues = new Set(sortedOptions.map((option) => option.value));
  const selectedOptions = useMemo(() => {
    return value
      .map((val) => optionRegistry.get(val))
      .filter((option): option is Option => Boolean(option));
  }, [value, optionRegistry]);
  const missingSelectedOptions = selectedOptions.filter(
    (option) => !baseValues.has(option.value)
  );
  const optionsToRender = [...missingSelectedOptions, ...sortedOptions];

  const showLabelOutside = label && labelVariant === "default";

  return (
    <div className={cn("space-y-2", fullWidth && "w-full")}>
      {showLabelOutside && <Label>{label}</Label>}
      <div className="relative">
        {showClearButton && (
          <button
            type="button"
            onClick={clearable.handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground z-10 transition-colors"
            aria-label="Limpiar selección"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}

        <Popover
          open={isOpen}
          onOpenChange={(nextOpen) => {
            setIsOpen(nextOpen);
            if (nextOpen) {
              setDropdownSide(determineDropdownSide());
            }
          }}
        >
          <PopoverTrigger asChild disabled={loading}>
            <button
              type="button"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls="multi-select-listbox"
              ref={triggerRef}
              className={cn(
                "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                !fullWidth && "w-auto",
                showClearButton && "pr-9"
              )}
            >
              {labelVariant === "inside" && label && selectedLabels.length > 0 && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
              )}
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
                            if (onValueChange) {
                              onValueChange(value.filter((v) => v !== opt.value));
                            }
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
                  {loading ? "Cargando..." : placeholder}
                </span>
              )}
              <ChevronDownIcon className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>

          <PopoverContent
            className="p-0 min-w-(--radix-popover-trigger-width)"
            align="start"
            side={dropdownSide}
            sideOffset={4}
            avoidCollisions={false}
          >
            {(onFilterChange || onSortChange) && (
              <div className="sticky top-0 z-10 border-b border-border bg-popover p-2">
                <div className="flex items-center gap-2">
                  {onFilterChange && (
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={inputRef}
                        placeholder={filterPlaceholder}
                        value={filterValue || ""}
                        onChange={(e) => onFilterChange(e.target.value)}
                        className="pl-10 pr-2 h-8"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                  {onSortChange && (
                    <Button
                      size="icon"
                      variant="default"
                      onClick={handleSortToggle}
                      aria-label={`Ordenar ${
                        sortDirection === "ASC" ? "descendente" : "ascendente"
                      }`}
                    >
                      {sortDirection === "ASC" ? (
                        <ArrowDownAZ className="h-4 w-4" />
                      ) : (
                        <ArrowUpZA className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {optionsToRender.length === 0 ? (
              <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                <AlertCircleIcon className="h-4 w-4" />
                {filterValue ? "No se encontraron resultados" : emptyText}
              </div>
            ) : (
              <ul id="multi-select-listbox" ref={scrollRef} className="max-h-60 overflow-y-auto p-1">
                {optionsToRender.map((option) => {
                  const isSelected = value.includes(option.value);
                  return (
                    <li
                      key={option.value}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => toggleOption(option.value)}
                      className={cn(
                        "flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-xs outline-none",
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
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
