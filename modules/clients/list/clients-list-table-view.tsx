"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useFormatter, useTranslations } from "next-intl";
import { UsersRound } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import type { Client } from "../lib/types/client.types";
import ClientActionsMenu from "../components/client-actions-menu";

export default function ClientsListTableView({ clients, onView, onEdit, onDelete }: { clients: Client[]; onView: (id: string) => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  const t = useTranslations("clients");
  const format = useFormatter();
  const columns: ColumnDef<Client>[] = [
    { accessorKey: "name", header: t("fields.name"), cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "email", header: t("fields.email"), cell: ({ row }) => <span className="break-all">{row.original.email || t("notProvided")}</span> },
    { accessorKey: "phone", header: t("fields.phone"), cell: ({ row }) => row.original.phone || t("notProvided") },
    { accessorKey: "company", header: t("fields.company"), cell: ({ row }) => row.original.company || t("notProvided") },
    { accessorKey: "createdAt", header: t("fields.createdAt"), cell: ({ row }) => format.dateTime(new Date(row.original.createdAt), { dateStyle: "medium", timeZone: "UTC" }) },
    { id: "actions", header: t("actions"), cell: ({ row }) => <ClientActionsMenu clientId={row.original.id} clientName={row.original.name} onView={onView} onEdit={onEdit} onDelete={onDelete} /> },
  ];
  return <DataTable tableId="clients-list" columns={columns} data={clients} getRowId={(client) => client.id} dataEmptyText={t("empty")} showPagination={false} headerConfig={{ title: t("title"), icon: <UsersRound className="h-6 w-6" /> }} />;
}
