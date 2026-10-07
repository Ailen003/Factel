"use client";

import { useTranslations } from "next-intl";
import type { ClientCreationDraft } from "../lib/types/client.types";

export default function ClientDetailsPresentational({ client }: { client: ClientCreationDraft }) {
  const t = useTranslations("clients");
  return <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {(["name", "email", "phone", "company", "address", "notes"] as const).map((field) => <div key={field} className={field === "notes" || field === "address" ? "sm:col-span-2" : ""}>
      <dt className="text-sm font-medium text-muted-foreground">{t(`fields.${field}`)}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{client[field] || t("notProvided")}</dd>
    </div>)}
  </dl>;
}
