"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { Box, Edit, Eye, Power, Trash, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type BulkActionsConfig } from "@/components/ui/data-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/dates";
import type { Widget } from "../lib/types/widget.types";

interface Props {
  widgets: Widget[];
  onViewWidget: (id: string) => void;
  onEditWidget: (id: string) => void;
  onToggleActive: (id: string) => void;
  onDeleteWidget: (id: string) => void;
  onBulkDelete: (ids: string[]) => Promise<void>;
  isDeletingWidgets: boolean;
}

export default function WidgetListTableView({
  widgets,
  onViewWidget,
  onEditWidget,
  onToggleActive,
  onDeleteWidget,
  onBulkDelete,
  isDeletingWidgets,
}: Props) {
  const t = useTranslations("table");
  const tWidgets = useTranslations("widgets");
  const tForm = useTranslations("widgetForm");

  const columns: ColumnDef<Widget>[] = [
    { accessorKey: "id", enableHiding: false },
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
          aria-label={t("selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          aria-label={t("selectRow")}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 48,
    },
    {
      accessorKey: "name",
      header: t("name"),
      cell: ({ row }) => (
        <div className="flex max-w-sm flex-col gap-0.5">
          <span className="font-medium text-foreground">{row.original.name}</span>
          {row.original.description && (
            <span className="line-clamp-2 text-xs text-muted-foreground">{row.original.description}</span>
          )}
        </div>
      ),
      size: 260,
    },
    {
      accessorKey: "type",
      header: tWidgets("type"),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn(
            "rounded-full border-transparent font-medium",
            row.original.type === "type_a"
              ? "bg-blue-100 text-blue-700"
              : "bg-green-100 text-green-700",
          )}
        >
          {tForm(`typeValues.${row.original.type}`)}
        </Badge>
      ),
    },
    {
      accessorKey: "isActive",
      header: t("status"),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn(
            "rounded-full border-transparent font-medium",
            row.original.isActive
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600",
          )}
        >
          {row.original.isActive ? tWidgets("active") : tWidgets("inactive")}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("created"),
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => {
        const { id, isActive } = row.original;
        return (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => onViewWidget(id)}>
                  <Eye className="size-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("viewDetails")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => onEditWidget(id)}>
                  <Edit className="size-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("edit")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => onToggleActive(id)}>
                  <Power className={cn("size-4", isActive ? "text-amber-600" : "text-green-600")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isActive ? t("deactivate") : t("activate")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => onDeleteWidget(id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("delete")}</TooltipContent>
            </Tooltip>
          </div>
        );
      },
      size: 180,
    },
  ];

  const bulkActionsConfig: BulkActionsConfig<string, Widget> = {
    actions: [
      {
        key: "delete",
        label: t("delete"),
        icon: Trash,
        variant: "destructive",
        onAction: onBulkDelete,
        isLoading: isDeletingWidgets,
        confirmation: {
          title: tWidgets("bulkDeleteTitle"),
          description: tWidgets("bulkDeleteDescription"),
          confirmLabel: t("confirmDelete"),
        },
      },
    ],
    entityName: { singular: tWidgets("singular"), plural: tWidgets("plural") },
    getRowId: (widget) => widget.id,
  };

  return (
    <DataTable
      tableId="widgets-list"
      columns={columns}
      data={widgets}
      initialVisibilityState={{ id: false }}
      headerConfig={{ title: tWidgets("title"), icon: <Box className="size-6" /> }}
      dataEmptyText={tWidgets("empty")}
      showPagination={false}
      bulkActionsConfig={bulkActionsConfig}
      maxHeight="calc(100vh - 280px)"
    />
  );
}
