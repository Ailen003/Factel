"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getConversationReviewAction, getProposalHistoryAction, markProposalReadyAction, saveProposalRevisionAction } from "../lib/actions/proposal.actions";
import { startConversationReprocessingAction, resolveReprocessingCandidateAction } from "../lib/actions/reprocessing.actions";
import type { ConversationReview, ProposalDraft, ProposalHistory, SaveProposalRevisionInput, ResolveReprocessingCandidateInput } from "../lib/types/proposal.types";
import type { ConversationCreationState } from "../lib/types/conversation-creation.types";

type CreationVersion = Pick<ConversationCreationState, "version" | "status" | "revisionId">;

export default function useConversationReview(conversationId: string, enabled: boolean, onChanged: () => void | Promise<void>) {
  const t = useTranslations("conversationReview");
  const [review, setReview] = useState<ConversationReview | null>(null);
  const [preview, setPreview] = useState<ConversationReview | null>(null);
  const [history, setHistory] = useState<ProposalHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const locked = useRef(false);
  const generation = useRef(0);
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const reprocessingOperation = useRef<{ signature: string; id: string } | null>(null);
  const creationVersion = useRef<CreationVersion | null>(null);
  const [creationState, setCreationState] = useState<CreationVersion | null>(null);
  const hasConflict = conflict || !!(review && creationState && creationState.version >= review.version && creationState.revisionId !== review.currentRevisionId);
  const errorFor = useCallback((code: string) => t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.INTERNAL_ERROR"), [t]);

  const load = useCallback(async (revisionId?: string, previewOnly = false) => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getConversationReviewAction({ conversationId, ...(revisionId ? { revisionId } : {}) });
      if (request !== generation.current) return null;
      if (!result.success) { setError(errorFor(result.error.code)); return null; }
      if (previewOnly) setPreview(result.data);
      else {
        const synced = creationVersion.current;
        const latest = synced && synced.version >= result.data.version;
        setReview(latest && synced.revisionId === result.data.currentRevisionId
          ? { ...result.data, version: synced.version, status: synced.status } : result.data);
        if (!latest) { creationVersion.current = null; setCreationState(null); }
        setPreview(null); setConflict(!!latest && synced.revisionId !== result.data.currentRevisionId);
      }
      return result.data;
    } catch { if (request === generation.current) setError(errorFor("INTERNAL_ERROR")); return null; }
    finally { if (request === generation.current) setLoading(false); }
  }, [conversationId, errorFor]);

  useEffect(() => {
    if (!enabled) return;
    const activeGeneration = generation;
    const timer = setTimeout(() => { void load(); }, 0);
    return () => { clearTimeout(timer); activeGeneration.current++; };
  }, [enabled, load]);

  const processing = review?.status === "extracting" || review?.status === "validating";
  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(() => { void load(); }, 3_000);
    return () => window.clearInterval(timer);
  }, [processing, load]);

  const acceptReview = useCallback((next: ConversationReview) => {
    generation.current++;
    creationVersion.current = null;
    setCreationState(null);
    setReview(next); setPreview(null); setHistory(null); setConflict(false); setLoading(false);
  }, []);

  const reprocess = useCallback(async (selection?: Pick<ResolveReprocessingCandidateInput, "keepPrevious" | "clientFields" | "requests" | "removeRequestIds">) => {
    if (locked.current || !review?.revision || hasConflict || processing || review.status === "completed") return null;
    if (selection ? !review.candidate : !!review.candidate) return null;
    locked.current = true; setBusy(true); setError(null);
    const base = { conversationId, expectedVersion: review.version };
    const signature = JSON.stringify({ ...base, candidate: review.candidate?.id, selection });
    if (reprocessingOperation.current?.signature !== signature) reprocessingOperation.current = { signature, id: crypto.randomUUID() };
    try {
      if (selection && review.candidate) {
        const result = await resolveReprocessingCandidateAction({ ...base, ...selection, baseRevisionId: review.revision.id,
          candidateRevisionId: review.candidate.id, operationId: reprocessingOperation.current.id });
        if (!result.success) {
          setError(errorFor(result.error.code));
          if (result.error.code === "STALE_VERSION" || result.error.code === "CANDIDATE_NOT_FOUND") setConflict(true);
          return null;
        }
        reprocessingOperation.current = null;
        acceptReview(result.data);
        try { await onChanged(); } catch { /* The committed decision remains authoritative. */ }
        return result.data;
      }
      const result = await startConversationReprocessingAction({ ...base, idempotencyKey: reprocessingOperation.current.id });
      if (!result.success) {
        setError(errorFor(result.error.code));
        if (result.error.code === "STALE_VERSION") setConflict(true);
        return null;
      }
      reprocessingOperation.current = null;
      const next = { ...review, version: result.data.version, status: "extracting" };
      acceptReview(next);
      try { await onChanged(); } catch { /* Polling will recover the accepted execution. */ }
      return next;
    } catch { setError(errorFor("INTERNAL_ERROR")); return null; }
    finally { locked.current = false; setBusy(false); }
  }, [conversationId, review, hasConflict, processing, errorFor, acceptReview, onChanged]);

  const loadHistory = useCallback(async (cursor?: string) => {
    setHistoryLoading(true);
    try {
      const result = await getProposalHistoryAction({ conversationId, ...(cursor ? { cursor } : {}) });
      if (!result.success) { setError(errorFor(result.error.code)); return; }
      setHistory((current) => ({ revisions: cursor ? [...(current?.revisions ?? []), ...result.data.revisions.filter((revision) => !current?.revisions.some((entry) => entry.id === revision.id))] : result.data.revisions, nextCursor: result.data.nextCursor }));
    } catch { setError(errorFor("INTERNAL_ERROR")); }
    finally { setHistoryLoading(false); }
  }, [conversationId, errorFor]);

  const mutate = useCallback(async (draft?: ProposalDraft, resolutions: SaveProposalRevisionInput["resolutions"] = []) => {
    if (locked.current || !review?.revision || hasConflict || review.candidate || processing) return null;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const base = { conversationId, expectedVersion: review.version };
      let result;
      if (draft) {
        const signature = JSON.stringify({ ...base, baseRevisionId: review.revision.id, draft, resolutions });
        if (operation.current?.signature !== signature) operation.current = { signature, id: crypto.randomUUID() };
        result = await saveProposalRevisionAction({ ...base, baseRevisionId: review.revision.id, operationId: operation.current.id, draft, resolutions });
      } else result = await markProposalReadyAction({ ...base, revisionId: review.revision.id });
      if (!result.success) {
        setError(errorFor(result.error.code));
        if (result.error.code === "STALE_VERSION") setConflict(true);
        return null;
      }
      operation.current = null;
      creationVersion.current = null;
      setCreationState(null);
      setReview(result.data);
      setHistory(null);
      setPreview(null);
      // Refresh failures must not turn an already committed save into an apparent failure.
      try { await onChanged(); } catch { /* The saved revision remains authoritative. */ }
      return result.data;
    } catch { setError(errorFor("INTERNAL_ERROR")); return null; }
    finally { locked.current = false; setBusy(false); }
  }, [conversationId, review, hasConflict, processing, errorFor, onChanged]);

  // Plan preparation changes the conversation version, never the local draft.
  const syncCreationState = useCallback((next: CreationVersion) => {
    if (creationVersion.current && creationVersion.current.version > next.version) return;
    creationVersion.current = next;
    setCreationState(next);
    setReview((current) => current && current.currentRevisionId === next.revisionId && current.version <= next.version
      ? { ...current, version: next.version, status: next.status } : current);
  }, []);

  return { review, preview, history, loading, busy, historyLoading, error, conflict: hasConflict, load, loadHistory, mutate, reprocess,
    invalidate: () => setConflict(true),
    syncCreationState, creationStatus: creationState?.status ?? null, returnToDraft: () => setPreview(null) };
}
