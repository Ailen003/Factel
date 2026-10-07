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
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Option {
  label: string;
  value: string;
}

interface SingleSelectFancyInputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: Option[];
  loading?: boolean;
  // Clearable
  clearable?: {
    handleClear: () => void;
  };
  fullWidth?: boolean;
  // Extra features
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterPlaceholder?: string;
  sortDirection?: "ASC" | "DESC";
  onSortChange?: (d: "ASC" | "DESC") => void;
  emptyText?: string;
  // Scroll infinito
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadNextPage?: () => void;
  labelVariant?: "default" | "inside";
}

export default function SelectInput({
  label,
  placeholder = "Selecciona un elemento",
  value,
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
}: SingleSelectFancyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const loadingRef = useRef(false); // evita llamadas múltiples

  // Autofocus cuando se abre
  useEffect(() => {
    if (isOpen && onFilterChange) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, onFilterChange]);

  // Scroll infinito REAL basado en scroll del usuario
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

        // throttle leve para evitar spam en scroll agresivo
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

  // Filtro local
  const filteredOptions = onFilterChange
    ? options
    : options.filter((opt) =>
        opt.label.toLowerCase().includes((filterValue || "").toLowerCase())
      );

  // Ordenamiento
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

  const showClearButton = clearable && value;

  const selectItem = useMemo(() => {
    const newOption = options.find((item) => item.value === value);
    if (newOption) {
      return {
        ...newOption,
        label: newOption.label + " (seleccionado)",
      };
    }
    return undefined;
  }, [value, options]);

  const showLabelOutside = label && labelVariant === "default";

  return (
    <div className={cn("space-y-2", fullWidth && "w-full")}>
      {showLabelOutside && <Label>{label}</Label>}
      <div className="relative">
        {/* Botón para limpiar */}
        {showClearButton && (
          <button
            type="button"
            onClick={clearable.handleClear}
            className="absolute right-9 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground z-10 transition-colors"
            aria-label="Limpiar selección"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}

        <Select
          open={isOpen}
          onOpenChange={setIsOpen}
          value={value ?? ""}
          onValueChange={onValueChange}
          disabled={loading}
        >
          <SelectTrigger
            className={cn("w-full", showClearButton && "[&>span]:pr-8")}
          >
            {labelVariant === "inside" && label && value ? (
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
                <SelectValue placeholder={loading ? "Cargando..." : placeholder} />
              </div>
            ) : (
              <SelectValue placeholder={loading ? "Cargando..." : placeholder} />
            )}
          </SelectTrigger>

          <SelectContent className="min-w-(--radix-select-trigger-width)">
            {/* Barra de búsqueda */}
            {onFilterChange && (
              <div className="p-2 border-b flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    placeholder={filterPlaceholder}
                    value={filterValue || ""}
                    onChange={(e) => onFilterChange(e.target.value)}
                    className="pl-10 pr-9"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Ordenar */}
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
            )}

            {/* Lista scrollable */}
            <div ref={scrollRef} className="max-h-60 overflow-auto py-1">
              {/* En caso de que el elemento seleccionado no esté en la lista */}
              {selectItem &&
                !sortedOptions.find(
                  (item) => item.value === selectItem.value
                ) && (
                  <SelectItem key={selectItem.value} value={selectItem.value}>
                    {selectItem.label}
                  </SelectItem>
                )}

              {sortedOptions.length > 0 ? (
                <>
                  {sortedOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}

                  {/* Loader al final */}
                  {hasNextPage && (
                    <div className="text-center">
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
              ) : (
                <div className="flex gap-2 p-2 text-xs text-muted-foreground">
                  <AlertCircleIcon className="h-4 w-4" />
                  {emptyText}
                </div>
              )}
            </div>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
