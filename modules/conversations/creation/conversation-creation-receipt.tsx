"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import ClientDetailsContainer from "@/modules/clients/details/client-details-container";
import ServiceRequestDetailsContainer from "@/modules/requests/details/service-request-details-container";
import type { ConversationCreationResult } from "../lib/types/conversation-creation.types";

export default function ConversationCreationReceipt({ result }: { result: ConversationCreationResult }) {
  const t = useTranslations("conversationCreation");
  const format = useFormatter();
  const [selected, setSelected] = useState<string | null>(null);
  const toggle = (id: string) => setSelected((current) => current === id ? null : id);
  return <section aria-label={t("receiptTitle")} className="space-y-3 rounded-lg border bg-muted/30 p-4">
    <h3 className="font-semibold">{t("receiptTitle")}</h3>
    <p role="status">{t("created", { count: result.requestIds.length })}</p>
    {result.replayed && <p className="text-sm text-muted-foreground">{t("replayed")}</p>}
    <p className="text-sm">{t("completedAt", { date: format.dateTime(new Date(result.completedAt), { dateStyle: "medium", timeStyle: "short" }) })}</p>
    <dl className="text-sm"><dt className="text-muted-foreground">{t("operation")}</dt><dd className="break-all">{result.operationId}</dd></dl>
    {result.clientId ? <div>
      <Button type="button" variant="outline" aria-expanded={selected === "client"} onClick={() => toggle("client")}>{t("viewClient")}</Button>
      {selected === "client" && <ClientDetailsContainer clientId={result.clientId} />}
    </div> : <p className="text-sm">{t("deletedClient")}</p>}
    <ul className="space-y-2">{result.requestIds.map((id, index) => <li key={id}>
      <Button type="button" variant="outline" aria-expanded={selected === id} onClick={() => toggle(id)}>{t("viewRequest", { number: index + 1 })}</Button>
      {selected === id && <ServiceRequestDetailsContainer requestId={id} />}
    </li>)}</ul>
    <p className="text-sm text-muted-foreground">{t("receiptHint")}</p>
  </section>;
}
