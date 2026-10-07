"use client";

import { WidgetDetails, getWidgetTypeInfo } from "../lib/types/widget.types";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

interface Props {
  widget: WidgetDetails;
}

export default function WidgetDetailsPresentational({ widget }: Props) {
  const t = useTranslations("widgetDetails");
  const tForm = useTranslations("widgetForm");
  const typeInfo = getWidgetTypeInfo(widget.type);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{widget.name}</h3>
        <Badge className={typeInfo.className}>{tForm(`typeValues.${widget.type}`)}</Badge>
      </div>
      {widget.description && (
        <p className="text-sm text-muted-foreground">{widget.description}</p>
      )}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="font-medium text-muted-foreground">{t("status")}:</span>
          <span className="ml-1">{widget.isActive ? t("active") : t("inactive")}</span>
        </div>
        <div>
          <span className="font-medium text-muted-foreground">{t("createdAt")}:</span>
          <span className="ml-1">{new Date(widget.createdAt).toLocaleDateString()}</span>
        </div>
        <div>
          <span className="font-medium text-muted-foreground">{t("createdBy")}:</span>
          <span className="ml-1">{widget.createdByUser?.full_name ?? widget.createdBy}</span>
        </div>
      </div>
    </div>
  );
}
