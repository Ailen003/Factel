"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmationDialog } from "@/components/confirmation-dialog/confirmation-dialog";
import { clientFieldKeys, requestFieldKeys, resolveReprocessingCandidateSchema, type ClientFieldKey, type RequestFieldKey,
  type ProposalField, type ProposalRevisionView, type ResolveReprocessingCandidateInput } from "../lib/types/proposal.types";
import ConversationReviewFindings from "./conversation-review-findings";
import ReviewFieldEvidenceButton from "./review-field-evidence-button";

export type ReprocessingSelection = Pick<ResolveReprocessingCandidateInput, "keepPrevious" | "clientFields" | "requests" | "removeRequestIds">;
const selectionSchema = resolveReprocessingCandidateSchema.pick({ keepPrevious: true, clientFields: true, requests: true, removeRequestIds: true });
const emptySelection: ReprocessingSelection = { keepPrevious: false, clientFields: [], requests: [], removeRequestIds: [] };

export default function ConversationReprocessingComparison({ current, candidate, busy, error, onResolve, onEvidence, onDirtyChange }: {
  current: ProposalRevisionView; candidate: ProposalRevisionView; busy: boolean;
  onResolve: (selection: ReprocessingSelection) => Promise<boolean>;
  onEvidence: (field: ProposalField | null) => void; onDirtyChange: (dirty: boolean) => void;
  error?: string | null;
}) {
  const t = useTranslations("conversationReview");
  const r = useTranslations("conversationReview.reprocessing");
  const clients = useTranslations("clients.fields");
  const requests = useTranslations("requests");
  const form = useForm<ReprocessingSelection>({ resolver: zodResolver(selectionSchema), defaultValues: emptySelection });
  const selection = useWatch({ control: form.control }) as ReprocessingSelection;
  const [keepOpen, setKeepOpen] = useState(false);
  const dirty = form.formState.isDirty;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  const set = (key: keyof ReprocessingSelection, value: ReprocessingSelection[keyof ReprocessingSelection]) => form.setValue(key, value, { shouldDirty: true });
  const selectedCount = selection.clientFields.length + selection.requests.reduce((count, item) => count + item.fields.length, 0) + selection.removeRequestIds.length;
  const finalRequestCount = current.draft.requests.length - selection.removeRequestIds.length + selection.requests.filter((item) => item.targetItemId === null).length;
  const validCount = finalRequestCount >= 1 && finalRequestCount <= 50;
  const value = (key: ClientFieldKey | RequestFieldKey, text: string) => !text ? t("emptyValue")
    : key === "serviceType" ? requests(`serviceTypes.${text}`) : key === "priority" ? requests(`priorities.${text}`) : text;
  const evidence = (revision: ProposalRevisionView, itemId: string | null, fieldKey: ProposalField["fieldKey"]) =>
    revision.fields.find((field) => field.target === (itemId === null ? "client" : "request") && field.itemId === itemId && field.fieldKey === fieldKey) ?? null;
  const comparisonField = (key: ClientFieldKey | RequestFieldKey, label: string, previous: string | null, next: string, itemId: string | null, targetId: string | null,
    checked: boolean, disabled: boolean, onToggle: () => void) => <div key={key} className="space-y-2 rounded-md border p-3">
      <Label className="flex items-center gap-2"><Checkbox checked={checked} disabled={busy || disabled} onCheckedChange={onToggle} aria-label={r("takeField", { field: label })} />{label}</Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><p className="text-xs font-medium text-muted-foreground">{r("current")}</p>
          <p className="whitespace-pre-wrap break-words text-sm">{previous === null ? r("noTarget") : value(key, previous)}</p>
          {previous !== null && <ReviewFieldEvidenceButton label={r("fieldSource", { field: label, source: r("current") })} onClick={() => onEvidence(evidence(current, targetId, key))} />}</div>
        <div><p className="text-xs font-medium text-muted-foreground">{r("candidate")}</p>
          <p className={`whitespace-pre-wrap break-words text-sm ${previous !== next ? "font-medium" : ""}`}>{value(key, next)}</p>
          <ReviewFieldEvidenceButton label={r("fieldSource", { field: label, source: r("candidate") })} onClick={() => onEvidence(evidence(candidate, itemId, key))} /></div>
      </div>
    </div>;

  return <section className="space-y-5 rounded-lg border p-4" aria-label={r("compareTitle")}>
    <div className="space-y-2"><h3 className="text-lg font-semibold">{r("compareTitle")}</h3><p className="text-sm text-muted-foreground">{r("compareDescription")}</p></div>
    <form noValidate onSubmit={form.handleSubmit(async (input) => { if (!busy && selectedCount > 0 && validCount) await onResolve(input); })} className="space-y-5">
      <section className="space-y-3" aria-label={t("client")}><h4 className="font-medium">{t("client")}</h4>
        {clientFieldKeys.map((key) => comparisonField(key, clients(key), current.draft.client[key], candidate.draft.client[key], null, null,
          selection.clientFields.includes(key), false, () => set("clientFields", selection.clientFields.includes(key) ? selection.clientFields.filter((field) => field !== key) : [...selection.clientFields, key])))}</section>
      <section className="space-y-3" aria-label={r("currentRequests")}><h4 className="font-medium">{r("currentRequests")}</h4>
        <p className="text-sm text-muted-foreground">{r("removeHint")}</p>
        {current.draft.requests.map((item, index) => <div key={item.stableItemId} className="rounded-md border p-3">
          <Label className="flex items-center gap-2"><Checkbox checked={selection.removeRequestIds.includes(item.stableItemId)}
            disabled={busy || selection.requests.some((entry) => entry.targetItemId === item.stableItemId)}
            onCheckedChange={() => set("removeRequestIds", selection.removeRequestIds.includes(item.stableItemId) ? selection.removeRequestIds.filter((id) => id !== item.stableItemId) : [...selection.removeRequestIds, item.stableItemId])} />
            {r("removeCurrent", { number: index + 1, title: item.title || t("emptyValue") })}</Label>
          <details className="mt-2"><summary className="cursor-pointer text-sm">{r("inspectCurrent")}</summary>
            <dl className="mt-2 space-y-2">{requestFieldKeys.map((key) => <div key={key}><dt className="text-xs text-muted-foreground">{requests(`fields.${key}`)}</dt>
              <dd className="whitespace-pre-wrap break-words text-sm">{value(key, item[key])}</dd>
              <ReviewFieldEvidenceButton label={requests(`fields.${key}`)} onClick={() => onEvidence(evidence(current, item.stableItemId, key))} /></div>)}</dl>
          </details>
        </div>)}</section>
      {candidate.draft.requests.map((item, index) => {
        const entry = selection.requests.find((entry) => entry.candidateItemId === item.stableItemId);
        const target = current.draft.requests.find((request) => request.stableItemId === entry?.targetItemId);
        const mapping = entry ? entry.targetItemId === null ? "add" : `existing:${entry.targetItemId}` : "ignore";
        const update = (next: ReprocessingSelection["requests"][number] | null) => set("requests", [...selection.requests.filter((entry) => entry.candidateItemId !== item.stableItemId), ...(next ? [next] : [])]);
        return <section key={item.stableItemId} className="space-y-3 rounded-lg border p-3" aria-label={r("candidateRequest", { number: index + 1 })}>
          <h4 className="font-medium">{r("candidateRequest", { number: index + 1 })}</h4>
          <Label htmlFor={`mapping-${item.stableItemId}`}>{r("requestChoice")}</Label>
          <Select value={mapping} disabled={busy} onValueChange={(selected) => update(selected === "ignore" ? null : {
            candidateItemId: item.stableItemId, targetItemId: selected === "add" ? null : selected.slice("existing:".length), fields: selected === "add" ? [...requestFieldKeys] : [],
          })}><SelectTrigger id={`mapping-${item.stableItemId}`}><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ignore">{r("ignoreRequest")}</SelectItem><SelectItem value="add">{r("addRequest")}</SelectItem>
            {current.draft.requests.map((request, number) => <SelectItem key={request.stableItemId} value={`existing:${request.stableItemId}`}
              disabled={selection.removeRequestIds.includes(request.stableItemId) || selection.requests.some((other) => other.candidateItemId !== item.stableItemId && other.targetItemId === request.stableItemId)}>
              {r("mapRequest", { number: number + 1, title: request.title || t("emptyValue") })}</SelectItem>)}
          </SelectContent></Select>
          {mapping === "add" && <p className="text-sm text-muted-foreground">{r("addHint")}</p>}
          {target && <p className="text-sm text-muted-foreground">{r("mapHint")}</p>}
          {requestFieldKeys.map((key) => comparisonField(key, requests(`fields.${key}`), target?.[key] ?? null, item[key], item.stableItemId, target?.stableItemId ?? null,
            !!entry?.fields.includes(key), !target, () => { if (entry) update({ ...entry, fields: entry.fields.includes(key) ? entry.fields.filter((field) => field !== key) : [...entry.fields, key] }); }))}
        </section>;
      })}
      <ConversationReviewFindings findings={candidate.findings} requestItems={candidate.draft.requests} resolutions={{}} onResolution={() => undefined} disabled />
      <p className="text-sm" role="status">{r("selectionSummary", { count: selectedCount, requests: finalRequestCount })}</p>
      {!validCount && <p className="text-sm text-destructive" role="alert">{t("invalidDraft")}</p>}
      <p className="text-sm text-muted-foreground">{r("decisionHint")}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || selectedCount === 0 || !validCount || selection.requests.some((entry) => entry.fields.length === 0)}>{r("adopt")}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => setKeepOpen(true)}>{r("keepPrevious")}</Button>
      </div>
    </form>
    <ConfirmationDialog open={keepOpen} onOpenChange={setKeepOpen} title={r("keepTitle")} description={r("keepDescription")}
      confirmLabel={r("keepPrevious")} cancelLabel={t("keepEditing")} isLoading={busy} error={error}
      onConfirm={async () => { if (await onResolve({ ...emptySelection, keepPrevious: true })) setKeepOpen(false); }} />
  </section>;
}
