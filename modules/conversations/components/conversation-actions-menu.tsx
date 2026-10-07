"use client";

import { Eye, MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function ConversationActionsMenu({ conversationId, label, onView, onDelete, canDelete }: {
  conversationId: string; label: string; onView: (id: string) => void; onDelete: (id: string) => void; canDelete: boolean;
}) {
  const t = useTranslations("conversations");
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={t("actionsFor", { label })}>
      <MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => onView(conversationId)}><Eye />{t("view")}</DropdownMenuItem>
      {canDelete && <DropdownMenuItem variant="destructive" onSelect={() => onDelete(conversationId)}><Trash2 />{t("deleteAction")}</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
