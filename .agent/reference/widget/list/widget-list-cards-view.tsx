"use client";

import { Box, Edit, Eye, MoreHorizontal, Power, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardViewWrapper } from "@/components/ui/card-view-wrapper";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Widget } from "../lib/types/widget.types";

interface Props {
  widgets: Widget[];
  onViewWidget: (id: string) => void;
  onEditWidget: (id: string) => void;
  onToggleActive: (id: string) => void;
  onDeleteWidget: (id: string) => void;
}

export default function WidgetListCardsView({
  widgets,
  onViewWidget,
  onEditWidget,
  onToggleActive,
  onDeleteWidget,
}: Props) {
  const t = useTranslations("table");
  const tWidgets = useTranslations("widgets");
  const tForm = useTranslations("widgetForm");

  return (
    <CardViewWrapper headerConfig={{ title: tWidgets("title"), icon: <Box className="size-6" /> }}>
      {widgets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {tWidgets("empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {widgets.map((widget) => (
            <article key={widget.id} className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h3 className="truncate font-medium">{widget.name}</h3>
                  {widget.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{widget.description}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t("actions")}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onViewWidget(widget.id)}>
                      <Eye /> {t("viewDetails")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onEditWidget(widget.id)}>
                      <Edit /> {t("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onToggleActive(widget.id)}>
                      <Power /> {widget.isActive ? t("deactivate") : t("activate")}
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => onDeleteWidget(widget.id)}>
                      <Trash2 /> {t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full border-transparent",
                    widget.type === "type_a"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-green-100 text-green-700",
                  )}
                >
                  {tForm(`typeValues.${widget.type}`)}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full border-transparent",
                    widget.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600",
                  )}
                >
                  {widget.isActive ? tWidgets("active") : tWidgets("inactive")}
                </Badge>
              </div>
            </article>
          ))}
        </div>
      )}
    </CardViewWrapper>
  );
}
