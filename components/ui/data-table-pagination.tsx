import { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  const currentPage = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const pageSize = table.getState().pagination.pageSize;
  const totalRows = table.getFilteredRowModel().rows.length;
  const startRow = currentPage * pageSize + 1;
  const endRow = Math.min((currentPage + 1) * pageSize, totalRows);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (pageCount <= 5) {
      for (let i = 0; i < pageCount; i++) pages.push(i);
    } else {
      pages.push(0);
      if (currentPage > 2) pages.push("...");
      const start = Math.max(1, currentPage - 1);
      const end = Math.min(pageCount - 2, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < pageCount - 3) pages.push("...");
      pages.push(pageCount - 1);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-between px-2 pt-2">
      <div className="text-sm text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{startRow}-{endRow}</span> of <span className="font-semibold text-foreground">{totalRows}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <span className="sr-only">Página anterior</span>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {getPageNumbers().map((page, idx) =>
          typeof page === "string" ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground">…</span>
          ) : (
            <Button
              key={page}
              variant={page === currentPage ? "default" : "outline"}
              className={`h-8 w-8 p-0 text-sm ${
                page === currentPage
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => table.setPageIndex(page)}
            >
              {page + 1}
            </Button>
          )
        )}
        <Button
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <span className="sr-only">Página siguiente</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
