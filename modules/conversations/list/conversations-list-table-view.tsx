"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MessagesSquare } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { DataTable } from "@/components/ui/data-table";
import type { ConversationSummary } from "../lib/types/conversation.types";
import ConversationActionsMenu from "../components/conversation-actions-menu";
import ConversationStatusBadge from "../components/conversation-status-badge";

function formatDuration(durationMs: number | null | undefined) {
  if (durationMs == null) return null;
  const seconds = Math.floor(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function ConversationsListTableView({ conversations, onView, onDelete }: {
  conversations: ConversationSummary[]; onView: (id: string) => void; onDelete: (id: string) => void;
}) {
  const t = useTranslations("conversations");
  const format = useFormatter();
  const columns: ColumnDef<ConversationSummary>[] = [
    { accessorKey: "sourceType", header: t("fields.source"), cell: ({ row }) => t(`sources.${row.original.sourceType}`) },
    { accessorKey: "locale", header: t("fields.locale"), cell: ({ row }) => t(`locales.${row.original.locale}`) },
    { accessorKey: "status", header: t("fields.status"), cell: ({ row }) => <ConversationStatusBadge status={row.original.status} /> },
    { accessorKey: "durationMs", header: t("fields.duration"), cell: ({ row }) => formatDuration(row.original.durationMs) ?? t("notAvailable") },
    { accessorKey: "createdAt", header: t("fields.createdAt"), cell: ({ row }) => format.dateTime(new Date(row.original.createdAt), { dateStyle: "medium", timeStyle: "short" }) },
    { id: "actions", header: t("actions"), cell: ({ row }) => <ConversationActionsMenu conversationId={row.original.id}
      label={format.dateTime(new Date(row.original.createdAt), { dateStyle: "medium" })} onView={onView} onDelete={onDelete}
      canDelete={row.original.status === "draft" || row.original.status === "audio_ready"} /> },
  ];
  return <DataTable tableId="conversations-list" columns={columns} data={conversations} getRowId={(item) => item.id}
    dataEmptyText={t("empty")} showPagination={false} headerConfig={{ title: t("title"), icon: <MessagesSquare className="h-6 w-6" /> }} />;
}
