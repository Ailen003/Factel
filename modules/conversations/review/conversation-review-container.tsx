"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertComponent } from "@/components/ui/alert-component";
import { ConfirmationDialog } from "@/components/confirmation-dialog/confirmation-dialog";
import type { ConversationDetails } from "../lib/types/conversation.types";
import { emptyRequestDraft, proposalDraftSchema, type ProposalDraft, type ProposalField } from "../lib/types/proposal.types";
import useConversationReview from "./use-conversation-review";
import ConversationReviewPresentational from "./conversation-review-presentational";
import ConversationReviewEvidence from "./conversation-review-evidence";
import ConversationReviewHistory from "./conversation-review-history";
import ConversationReviewPreview from "./conversation-review-preview";
import ConversationCreationContainer from "../creation/conversation-creation-container";
import ConversationReprocessingComparison from "./conversation-reprocessing-comparison";

export interface ReviewGuard { dirty: boolean; busy: boolean }

export default function ConversationReviewContainer({ conversation, onChanged, onGuardChange, onSeek }: {
  conversation: ConversationDetails; onChanged: () => void | Promise<void>; onGuardChange?: (guard: ReviewGuard) => void; onSeek: (startMs: number) => void;
}) {
  const t = useTranslations("conversationReview");
  const enabled = ["needs_review", "ready", "record_plan_pending", "completed", "extracting", "validating"].includes(conversation.status);
  const state = useConversationReview(conversation.id, enabled, onChanged);
  const form = useForm<ProposalDraft>({
    resolver: zodResolver(proposalDraftSchema, { errorMap: () => ({ message: t("invalidDraft") }) }),
    defaultValues: { client: { name: "", email: "", phone: "", company: "", address: "", notes: "" }, requests: [emptyRequestDraft("initial")] },
    values: state.review?.revision?.draft,
  });
  const { formState: { isDirty } } = form;
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [selectedField, setSelectedField] = useState<ProposalField | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [invalidDraft, setInvalidDraft] = useState(false);
  const [creationGuard, setCreationGuard] = useState({ busy: false, active: false });
  const [comparisonDirty, setComparisonDirty] = useState(false);
  const [reprocessOpen, setReprocessOpen] = useState(false);
  const draftDirty = isDirty || Object.values(resolutions).some((reason) => reason.trim().length > 0);
  const dirty = draftDirty || comparisonDirty;
  const revision = state.review?.revision;
  const candidate = state.review?.candidate;
  const status = conversation.status === "completed" ? "completed" : state.creationStatus ?? state.review?.status ?? conversation.status;
  const processing = ["extracting", "validating"].includes(status) || ["extracting", "validating"].includes(conversation.status);
  const creationVisible = !candidate && !processing;
  const busy = state.busy || state.loading || (creationVisible && creationGuard.busy);
  const readOnly = status === "completed" || status === "record_plan_pending" || (creationVisible && creationGuard.active) || processing || !!candidate;
  const canReprocess = !!revision && ["needs_review", "ready", "record_plan_pending"].includes(status) && !candidate && !processing;
  const previousStatus = useRef(conversation.status);

  useEffect(() => {
    const wasProcessing = ["extracting", "validating"].includes(previousStatus.current);
    const isProcessing = ["extracting", "validating"].includes(conversation.status);
    previousStatus.current = conversation.status;
    if (wasProcessing || isProcessing) {
      if (draftDirty || comparisonDirty) state.invalidate();
      else void state.load();
    }
  // Only status transitions refresh the review; ordinary detail refreshes preserve local edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.status]);

  useEffect(() => { onGuardChange?.({ dirty, busy }); }, [dirty, busy, onGuardChange]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [dirty, busy]);

  const onResolution = useCallback((id: string, reason: string) => setResolutions((current) => ({ ...current, [id]: reason })), []);
  const save = async (draft: ProposalDraft) => {
    if (readOnly || creationGuard.busy) return;
    setInvalidDraft(false);
    const result = await state.mutate(draft, Object.entries(resolutions).filter(([, reason]) => reason.trim()).map(([findingId, reason]) => ({ findingId, reason: reason.trim() })));
    if (result?.revision) { form.reset(result.revision.draft); setResolutions({}); setSelectedField(null); toast.success(t("saved")); }
  };
  const markReady = async () => { if (!readOnly && !creationGuard.busy && await state.mutate()) toast.success(t("markedReady")); };

  if (!enabled && !revision) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t("pending")}</p>;
  return <div className="space-y-4">
    {creationVisible && <ConversationCreationContainer conversationId={conversation.id} status={status}
      eligible={status === "ready" && !!revision?.readyAt && !dirty && !busy && !state.conflict && !state.preview}
      onStateChange={state.syncCreationState} onChanged={onChanged} onGuardChange={setCreationGuard} />}
    {canReprocess && <section className="space-y-2 rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{t("reprocessing.startHint")}</p>
      <Button type="button" variant="outline" disabled={dirty || busy || state.conflict || !!state.preview || conversation.credits.available < 1}
        onClick={() => setReprocessOpen(true)}>{t("reprocessing.start")}</Button>
      {dirty && <p className="text-xs text-muted-foreground">{t("reprocessing.saveFirst")}</p>}
      {conversation.credits.available < 1 && <p className="text-xs text-muted-foreground">{t("reprocessing.noCredits")}</p>}
    </section>}
    {processing && revision && <p role="status" className="rounded-lg border p-4 text-sm">{t("reprocessing.processing")}</p>}
    {!processing && !candidate && revision && conversation.processingRun?.status === "failed" && <p role="status" className="rounded-lg border p-4 text-sm">{t("reprocessing.failed")}</p>}
    {state.error && <AlertComponent title={state.error} variant="destructive" />}
    {state.loading && <p role="status" className="text-sm text-muted-foreground">{t("loading")}</p>}
    {!revision && !state.loading && <Button type="button" variant="outline" onClick={() => void state.load()}>{t("retry")}</Button>}
    {state.conflict && <div className="space-y-3 rounded-lg border border-destructive/40 p-4">
      <p className="text-sm">{t("conflictHint")}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={state.loading} onClick={() => void state.load(undefined, true)}>{t("viewCurrent")}</Button>
        <Button type="button" variant="outline" disabled={state.loading} onClick={() => setDiscardOpen(true)}>{t("discardReload")}</Button>
      </div>
    </div>}
    {revision && <>
      <ConversationReviewHistory history={state.history} loading={state.historyLoading} disabled={busy}
        onLoad={(cursor) => void state.loadHistory(cursor)} onSelect={(id) => { setSelectedField(null); void state.load(id, true); }} />
      {state.preview?.revision && <Button type="button" variant="outline" onClick={() => { state.returnToDraft(); setSelectedField(null); }}>{t("returnToDraft")}</Button>}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {candidate && status !== "completed" && <div hidden={!!state.preview}><ConversationReprocessingComparison key={`${revision.id}:${candidate.id}`} current={revision} candidate={candidate}
            error={state.error}
            busy={busy || state.conflict || draftDirty || processing} onDirtyChange={setComparisonDirty} onEvidence={setSelectedField}
            onResolve={async (selection) => {
              if (busy || state.conflict || draftDirty || processing) return false;
              const result = await state.reprocess(selection);
              if (!result?.revision) return false;
              form.reset(result.revision.draft); setResolutions({}); setSelectedField(null); setComparisonDirty(false); setCreationGuard({ busy: false, active: false });
              toast.success(t(selection.keepPrevious ? "reprocessing.kept" : "reprocessing.adopted"));
              return true;
            }} /></div>}
          {state.preview?.revision && <ConversationReviewPreview revision={state.preview.revision} onEvidence={setSelectedField} />}
          {!state.preview && readOnly && !candidate && <ConversationReviewPreview revision={revision} onEvidence={setSelectedField} />}
          <div hidden={!!state.preview || readOnly}>
            <FormProvider {...form}>
              <form noValidate onSubmit={form.handleSubmit(save, () => setInvalidDraft(true))}>
                <ConversationReviewPresentational revision={revision} busy={busy || readOnly} conflict={state.conflict} dirty={dirty}
                  resolutions={resolutions} onResolution={onResolution} onEvidence={setSelectedField} onMarkReady={() => void markReady()} invalidDraft={invalidDraft} />
              </form>
            </FormProvider>
          </div>
        </div>
        <ConversationReviewEvidence field={selectedField} transcript={conversation.transcript} onSeek={onSeek} canSeek={!!conversation.audio?.playbackPath} />
      </div>
    </>}
    <ConfirmationDialog open={reprocessOpen} onOpenChange={setReprocessOpen} title={t("reprocessing.confirmTitle")} description={t("reprocessing.confirmDescription")}
      confirmLabel={t("reprocessing.confirm")} cancelLabel={t("keepEditing")} isLoading={state.busy} error={state.error}
      disabled={!canReprocess || dirty || state.loading || creationGuard.busy || state.conflict}
      onConfirm={async () => {
        if (!canReprocess || dirty || busy || state.conflict) return;
        if (await state.reprocess()) { setReprocessOpen(false); setCreationGuard({ busy: false, active: false }); setSelectedField(null); }
      }} />
    <ConfirmationDialog open={discardOpen} onOpenChange={setDiscardOpen} title={t("discardTitle")} description={t("discardDescription")}
      confirmLabel={t("discardReload")} cancelLabel={t("keepEditing")} isLoading={state.loading}
      onConfirm={async () => {
        const current = await state.load();
        if (current?.revision) { form.reset(current.revision.draft); setResolutions({}); setSelectedField(null); setInvalidDraft(false); setDiscardOpen(false); }
      }} />
  </div>;
}
