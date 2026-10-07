"use client";

import { useTranslations } from "next-intl";
import { CardViewWrapper } from "@/components/ui/card-view-wrapper";
import type { Client } from "../lib/types/client.types";
import ClientActionsMenu from "../components/client-actions-menu";

export default function ClientsListCardsView({ clients, onView, onEdit, onDelete }: { clients: Client[]; onView: (id: string) => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  const t = useTranslations("clients");
  return <CardViewWrapper headerConfig={{ title: t("title") }}>
    {clients.length === 0 ? <p className="rounded-lg border p-6 text-center text-muted-foreground">{t("empty")}</p> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{clients.map((client) => <article key={client.id} className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2"><h3 className="break-words font-semibold">{client.name}</h3><ClientActionsMenu clientId={client.id} clientName={client.name} onView={onView} onEdit={onEdit} onDelete={onDelete} /></div>
      <dl className="mt-3 space-y-2 text-sm">{(["email", "phone", "company"] as const).map((field) => <div key={field}><dt className="text-xs text-muted-foreground">{t(`fields.${field}`)}</dt><dd className="break-words">{client[field] || t("notProvided")}</dd></div>)}</dl>
    </article>)}</div>}
  </CardViewWrapper>;
}
