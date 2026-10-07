"use client";

import { Edit, Eye, MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function ClientActionsMenu({ clientId, clientName, onView, onEdit, onDelete }: {
  clientId: string; clientName: string; onView: (id: string) => void;
  onEdit: (id: string) => void; onDelete: (id: string) => void;
}) {
  const t = useTranslations("clients");
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={t("actionsFor", { name: clientName })}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => onView(clientId)}><Eye />{t("view")}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onEdit(clientId)}><Edit />{t("editAction")}</DropdownMenuItem>
      <DropdownMenuItem variant="destructive" onSelect={() => onDelete(clientId)}><Trash2 />{t("deleteAction")}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
