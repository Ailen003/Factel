"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const LIMIT_OPTIONS = [10, 20, 50, 100];

interface Props {
  pagination: PaginationMeta;
  limitOptions?: number[];
}

export default function ModulePagination({
  pagination,
  limitOptions = LIMIT_OPTIONS,
}: Props) {
  const t = useTranslations('pagination');
  const { page, limit, total, totalPages } = pagination;

  // Asegurarse de que todos los valores de paginación sean números
  const currentPage = Number(page);
  const currentLimit = Number(limit);
  const currentTotal = Number(total);
  const currentTotalPages = Number(totalPages);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigateTo = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(newPage));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const changeLimit = useCallback(
    (newLimit: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("limit", newLimit);
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const startItem =
    currentTotal === 0 ? 0 : (currentPage - 1) * currentLimit + 1;
  const endItem = Math.min(currentPage * currentLimit, currentTotal);

  const getPageNumbers = (): (number | "...")[] => {
    if (currentTotalPages <= 5) {
      return Array.from({ length: currentTotalPages }, (_, i) => i + 1);
    }

    const pages: (number | "...")[] = [];
    const delta = 1; // pages shown on each side of current

    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(currentTotalPages - 1, currentPage + delta);

    pages.push(1);

    if (rangeStart > 2) pages.push("...");

    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }

    if (rangeEnd < currentTotalPages - 1) pages.push("...");

    pages.push(currentTotalPages);

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex flex-col ultra-xs:flex-row ultra-xs:items-center ultra-xs:justify-between px-1.5 py-2 ultra-xs:px-2 ultra-xs:py-3 border-t gap-2 ultra-xs:gap-0">
      <div className="flex flex-col ultra-xs:flex-row ultra-xs:items-center gap-2 ultra-xs:gap-3">
        <p className="text-[10px] text-muted-foreground ultra-xs:text-xs sm:text-sm">
          {t('showing')}{" "}
          <span className="font-semibold text-foreground">
            {startItem}-{endItem}
          </span>{" "}
          {t('of')} <span className="font-semibold text-foreground">{total}</span>
        </p>
        <div className="flex items-center gap-1 ultra-xs:gap-1.5">
          <span className="text-[10px] text-muted-foreground ultra-xs:text-xs sm:text-sm">{t('rows')}:</span>
          <Select value={String(limit)} onValueChange={changeLimit}>
            <SelectTrigger className="h-7 ultra-xs:h-8 max-w-16 ultra-xs:max-w-20 text-[10px] ultra-xs:text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {limitOptions.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-center ultra-xs:justify-start">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 ultra-xs:h-8 ultra-xs:w-8 rounded-none rounded-l-md"
          onClick={() => navigateTo(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <span className="sr-only">{t('previousPage')}</span>
          <ChevronLeft className="h-3.5 w-3.5 ultra-xs:h-4 ultra-xs:w-4" />
        </Button>

        {pages.map((p, idx) =>
          p === "..." ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-0.5 ultra-xs:px-1 text-[10px] ultra-xs:text-xs text-muted-foreground select-none sm:text-sm"
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => navigateTo(p)}
              className={cn(
                "h-7 w-7 ultra-xs:h-8 ultra-xs:w-8 text-[10px] ultra-xs:text-xs font-medium transition-colors border sm:text-sm",
                currentPage === p
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-background text-foreground border-border hover:bg-muted",
              )}
            >
              {p}
            </button>
          ),
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 ultra-xs:h-8 ultra-xs:w-8 rounded-none rounded-r-md"
          onClick={() => navigateTo(currentPage + 1)}
          disabled={currentPage >= currentTotalPages}
        >
          <span className="sr-only">{t('nextPage')}</span>
          <ChevronRight className="h-3.5 w-3.5 ultra-xs:h-4 ultra-xs:w-4" />
        </Button>
      </div>
    </div>
  );
}
