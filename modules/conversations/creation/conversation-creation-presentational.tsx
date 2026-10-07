"use client";

import { useFormatter, useTranslations } from "next-intl";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import ClientDetailsPresentational from "@/modules/clients/details/client-details-presentational";
import type useConversationCreation from "../lib/hooks/use-conversation-creation";
import { requestFieldKeys } from "../lib/types/proposal.types";
import ConversationCreationReceipt from "./conversation-creation-receipt";

export default function ConversationCreationPresentational({ creation, eligible }: {
  creation: ReturnType<typeof useConversationCreation>; eligible: boolean;
}) {
  const t = useTranslations("conversationCreation");
  const requests = useTranslations("requests");
  const format = useFormatter();
  const { state, active, isLoading, uncertain, expired, acknowledged, error } = creation;
  const preview = state?.preview;
  const result = state?.result;
  const locked = isLoading || uncertain;
  if (result) return <ConversationCreationReceipt result={result} />;
  if (!active) return <Button type="button" disabled={!eligible || isLoading} onClick={() => void creation.start()}>{t("start")}</Button>;
  return <section aria-label={t("title")} className="space-y-5 rounded-lg border p-4">
    <div><h3 className="font-semibold">{t("title")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("hint")}</p></div>
    {error && <AlertComponent title={error} variant="destructive" />}
    {isLoading && <p role="status" className="text-sm text-muted-foreground">{t("loading")}</p>}
    {!!state?.duplicates.length && <div className="space-y-3">
      <h4 className="font-medium">{t("duplicatesTitle", { count: state.duplicates.length })}</h4>
      <p className="text-sm text-muted-foreground">{t("duplicatesHint")}</p>
      <ul className="space-y-2">{state.duplicates.map((client) => <li key={client.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 p-3">
        <div className="min-w-0 text-sm"><p className="font-medium">{client.name}</p><p className="break-all text-muted-foreground">{[client.email, client.phone, client.company].filter(Boolean).join(" · ")}</p></div>
        <Button type="button" variant="outline" size="sm" disabled={locked || (preview?.choice.kind === "existing" && preview.choice.clientId === client.id)} onClick={() => void creation.prepare({ kind: "existing", clientId: client.id })}>{t("useExisting", { name: client.name })}</Button>
      </li>)}</ul>
      <Button type="button" variant="outline" disabled={locked || preview?.choice.kind === "new"} onClick={() => void creation.prepare({ kind: "new" })}>{t("useNew")}</Button>
    </div>}
    {preview && <>
      <h4 className="font-medium">{t(preview.choice.kind === "existing" ? "existingClient" : "newClient")}</h4>
      {preview.choice.kind === "existing" && <p className="text-sm text-muted-foreground">{t("preserveClient")}</p>}
      <ClientDetailsPresentational client={preview.client} />
      <h4 className="font-medium">{t("requests", { count: preview.requests.length })}</h4>
      {preview.requests.map((request, index) => <section key={request.stableItemId} className="space-y-3 rounded-lg border p-3" aria-label={t("requestNumber", { number: index + 1 })}>
        <h5 className="font-medium">{t("requestNumber", { number: index + 1 })}</h5>
        <dl className="grid gap-3 sm:grid-cols-2">
          {requestFieldKeys.map((key) => <div key={key} className={["description", "serviceAddress", "nextSteps"].includes(key) ? "sm:col-span-2" : ""}>
            <dt className="text-sm text-muted-foreground">{requests(`fields.${key}`)}</dt>
            <dd className="whitespace-pre-wrap break-words text-sm">{!request[key] ? requests("notProvided") : key === "serviceType" ? requests(`serviceTypes.${request.serviceType}`) : key === "priority" ? requests(`priorities.${request.priority}`) : request[key]}</dd>
          </div>)}
          <div><dt className="text-sm text-muted-foreground">{requests("fields.status")}</dt><dd className="text-sm">{requests("statuses.pending")}</dd></div>
        </dl>
      </section>)}
      <p className="text-xs text-muted-foreground">{t("expiresAt", { date: format.dateTime(new Date(preview.expiresAt), { dateStyle: "short", timeStyle: "short" }) })}</p>
      {preview.choice.kind === "new" && preview.duplicates.length > 0 && <div className="flex items-start gap-2">
        <Checkbox id="conversation-acknowledge-duplicates" checked={acknowledged} disabled={locked} onCheckedChange={(value) => creation.acknowledge(value === true)} />
        <Label htmlFor="conversation-acknowledge-duplicates" className="text-sm leading-relaxed">{t("acknowledgeDuplicates")}</Label>
      </div>}
      {expired && !uncertain && <AlertComponent variant="destructive" title={t("expired")} />}
    </>}
    <div className="flex flex-wrap gap-3 border-t pt-4">
      <Button type="button" variant="outline" disabled={locked} onClick={() => void creation.abandon()}>{t("back")}</Button>
      {!preview && <Button type="button" disabled={locked} onClick={() => void creation.start()}>{t("retry")}</Button>}
      {preview && expired && !uncertain && <Button type="button" disabled={locked} onClick={() => void creation.start()}>{t("reload")}</Button>}
      {preview && expired && !uncertain && <Button type="button" disabled={locked} onClick={() => void creation.prepare(preview.choice)}>{t("regenerate")}</Button>}
      {preview && <Button type="button" disabled={isLoading || (!uncertain && (expired || (preview.choice.kind === "new" && preview.duplicates.length > 0 && !acknowledged)))} onClick={() => void creation.confirm()}>
        {t(isLoading ? "confirming" : uncertain ? "retryConfirmation" : preview.choice.kind === "new" ? "confirmNew" : "confirmExisting", { count: preview.requests.length })}
      </Button>}
    </div>
  </section>;
}
