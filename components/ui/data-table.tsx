"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  VisibilityState,
  RowSelectionState,
} from "@tanstack/react-table";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import React, { ReactNode, useEffect, useMemo, CSSProperties } from "react";
import { Button } from "./button";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  BulkActionsBar,
  BulkAction,
} from "@/components/bulk-actions-bar/bulk-actions-bar";
import { DataTablePagination } from "./data-table-pagination";

export interface BulkActionsConfig<TId = string, TData = any> {
  /**
   * Bulk actions to show when rows are selected.
   * Can be a static array or a function that receives selected IDs and returns filtered actions.
   */
  actions: BulkAction<TId>[] | ((selectedIds: TId[]) => BulkAction<TId>[]);
  /**
   * Entity name for bulk actions bar.
   * e.g. { singular: "contact", plural: "contacts" }
   */
  entityName: { singular: string; plural: string };
  /**
   * Function to get the unique ID from a row.
   */
  getRowId: (row: TData) => string;
}

export interface HeaderConfig {
  /**
   * Title to display above the table. Required when headerConfig is provided.
   */
  title: string;
  /**
   * Optional icon to display alongside the title.
   */
  icon?: ReactNode;
}

/**
 * Describes a column that should remain sticky during horizontal scrolling.
 *
 * - `columnId`  – must match the column `id` (or `accessorKey`) used in the
 *                 ColumnDef so the component can match headers/cells.
 * - `position`  – `"left"` or `"right"` side of the table.
 * - `offset`    – CSS left/right value, e.g. `"0px"`, `"52px"`.
 *                 For multiple left‑sticky columns you must set increasing
 *                 offsets so they stack correctly.
 * - `width`     – optional explicit width for the column, e.g. `"48px"`, `"200px"`.
 *                 Helps prevent overlapping when using sticky columns.
 * - `shadow`    – optional box‑shadow for the visual separator edge.
 */
export interface StickyColumnConfig {
  columnId: string;
  position: "left" | "right";
  offset: string;
  width?: string;
  shadow?: string;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Stable row identity, independent of optional bulk selection. */
  getRowId?: (row: TData) => string;
  dataEmptyText?: string;
  initialVisibilityState?: VisibilityState;
  filters?: ReactNode;
  paginationComponent?: ReactNode;
  showColumnToggle?: boolean;
  showHeader?: boolean;
  showPagination?: boolean;
  /**
   * Unique identifier for this table instance.
   * Used to persist column visibility state in localStorage.
   * If not provided, column visibility will not persist across sessions.
   */
  tableId?: string;
  /**
   * Maximum height for the scrollable table area.
   * When set the table header will stick to the top on vertical scroll.
   * Accepts any valid CSS max‑height value (e.g. `"calc(100vh - 280px)"`).
   * Defaults to `undefined` (no vertical constraint / no sticky header).
   */
  maxHeight?: string;
  /**
   * Columns that should remain visible (sticky) during horizontal scrolling.
   * Each entry specifies the column, its pinned side and its CSS offset.
   */
  stickyColumns?: StickyColumnConfig[];
  /** Background applied to the sticky header row. Defaults to a light green-to-blue gradient. */
  headerBg?: string;
  /**
   * Bulk actions configuration.
   * When provided, enables row selection and shows bulk actions bar.
   * If not provided, the table will not have bulk actions functionality.
   */
  bulkActionsConfig?: BulkActionsConfig<string>;
  /**
   * Header configuration with title and optional icon.
   * When provided, displays an elegant header above the table.
   */
  headerConfig?: HeaderConfig;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  getRowId,
  dataEmptyText,
  initialVisibilityState = {},
  filters,
  paginationComponent,
  showColumnToggle = true,
  showHeader = true,
  showPagination = true,
  maxHeight,
  stickyColumns = [],
  headerBg = "linear-gradient(180deg, #F4F8EC 0%, #EEF4FB 100%)",
  bulkActionsConfig,
  tableId,
  headerConfig,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations('common');
  const storageKey = tableId ? `table-column-visibility-${tableId}` : null;
  const initialVisibilityStateJson = JSON.stringify(initialVisibilityState);

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialVisibilityState);

  // Load from localStorage after hydration
  React.useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(storageKey);
        const stableInitialVisibilityState = JSON.parse(
          initialVisibilityStateJson,
        ) as VisibilityState;
        if (stored) {
          const parsed = JSON.parse(stored);
          // Merge with initialVisibilityState to ensure required columns are always visible
          // Stored values should override initial defaults
          setColumnVisibility({ ...stableInitialVisibilityState, ...parsed });
        }
      } catch (error) {
        console.error(
          "Error loading column visibility from localStorage:",
          error,
        );
      }
    }
  }, [storageKey, initialVisibilityStateJson]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const hasBulkActions = !!bulkActionsConfig;
  const searchParams = useSearchParams();

  // TanStack Table intentionally returns mutable helpers that React Compiler cannot memoize safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: hasBulkActions,
    getRowId: getRowId ?? bulkActionsConfig?.getRowId,
    initialState: {
      pagination: {
        pageSize: showPagination
          ? Number(searchParams.get("limit")) || 10
          : data.length,
      },
    },
    state: {
      columnVisibility,
      rowSelection,
    },
  });

  useEffect(() => {
    if (paginationComponent && showPagination) {
      table.setPageSize(Number(searchParams.get("limit")) || 10);
    }
  }, [paginationComponent, showPagination, table, searchParams]);

  useEffect(() => {
    if (!showPagination) {
      table.setPageSize(data.length);
    }
  }, [data.length, showPagination, table]);

  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
      } catch (error) {
        console.error("Error saving column visibility to localStorage:", error);
      }
    }
  }, [columnVisibility, storageKey]);

  // Build a lookup map: columnId → sticky style + className
  const stickyMap = useMemo(() => {
    const map = new Map<string, { style: CSSProperties; className: string }>();
    for (const cfg of stickyColumns) {
      const style: CSSProperties = {
        position: "sticky",
        [cfg.position]: cfg.offset,
        ...(cfg.width
          ? { width: cfg.width, minWidth: cfg.width, maxWidth: cfg.width }
          : {}),
        ...(cfg.shadow ? { boxShadow: cfg.shadow } : {}),
      };
      // z-index: header cells get a higher z so they layer above body sticky cells
      // We only set the base z here; header cells are bumped in the render below.
      map.set(cfg.columnId, {
        style,
        className: "", // intentionally left empty; shadows via inline style
      });
    }
    return map;
  }, [stickyColumns]);

  /** Return inline sticky styles for a given column id */
  const getStickyStyle = (
    columnId: string,
    isHeader: boolean,
  ): CSSProperties => {
    const entry = stickyMap.get(columnId);
    if (!entry) return {};
    return {
      ...entry.style,
      zIndex: isHeader ? 30 : 10,
      ...(isHeader ? { background: headerBg } : {}),
    };
  };

  const selectedIds = Object.keys(rowSelection);

  const handleClearSelection = () => {
    setRowSelection({});
  };

  // Resolve actions: if it's a function, call it with selected IDs
  let resolvedActions: BulkAction<string>[];
  if (bulkActionsConfig && typeof bulkActionsConfig.actions === 'function') {
    resolvedActions = bulkActionsConfig.actions(selectedIds);
  } else {
    resolvedActions = (bulkActionsConfig?.actions as BulkAction<string>[]) || [];
  }

  return (
    <div className="flex flex-col gap-3">
      {showHeader && (
        <div className="flex gap-4 items-center">
          {headerConfig && (
            <div className="flex items-center gap-2">
              {headerConfig.icon && (
                <div className="text-primary">{headerConfig.icon}</div>
              )}
              <h2 className="text-xl font-semibold tracking-tight">{headerConfig.title}</h2>
            </div>
          )}
          {filters && filters}
          {showColumnToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto">
                  {t('columns')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {typeof column.columnDef.header === "string"
                          ? column.columnDef.header
                          : column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Single scroll container for both horizontal and vertical scroll */}
        <div
          className="w-full overflow-auto relative"
          style={maxHeight ? { maxHeight } : undefined}
        >
          <table className="w-full caption-bottom text-xs relative">
            <thead className="text-foreground">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className={cn(
                    "border-b border-border",
                    maxHeight && "sticky top-0 z-30 shadow-xs",
                  )}
                  style={{ background: headerBg }}
                >
                  {headerGroup.headers.map((header) => {
                    const stickyStyle = getStickyStyle(header.column.id, true);
                    const isSelectColumn = header.column.id === "select";
                    return (
                      <th
                        key={header.id}
                        className={cn(
                          "h-12 px-4 text-left align-middle font-semibold [&:has([role=checkbox])]:pr-0",
                          maxHeight && "sticky top-0",
                          isSelectColumn && "header-checkbox-cell",
                        )}
                        style={maxHeight ? { background: headerBg, ...stickyStyle } : stickyStyle}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="group border-b border-border transition-colors hover:bg-muted data-[state=selected]:bg-primary/10"
                  >
                    {row.getVisibleCells().map((cell) => {
                      const stickyStyle = getStickyStyle(cell.column.id, false);
                      const isSticky = stickyMap.has(cell.column.id);
                      const isRowSelected = row.getIsSelected();
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "p-4 align-middle [&:has([role=checkbox])]:pr-0",
                            isSticky &&
                            cn(
                              "bg-background transition-colors duration-150",
                              isRowSelected && "bg-primary/10",
                              !isRowSelected && "group-hover:bg-muted",
                            ),
                          )}
                          style={stickyStyle}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="h-24 text-center p-4 align-middle"
                  >
                    {dataEmptyText || t('noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {showPagination &&
        (paginationComponent ? (
          paginationComponent
        ) : (
          <DataTablePagination table={table} />
        ))}
      {hasBulkActions && (
        <BulkActionsBar
          selectedIds={selectedIds}
          onClearSelection={handleClearSelection}
          actions={resolvedActions}
          entityName={bulkActionsConfig.entityName}
        />
      )}
    </div>
  );
}
