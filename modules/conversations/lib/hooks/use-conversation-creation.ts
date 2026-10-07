"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { abandonConversationCreationAction, confirmConversationCreationAction, getConversationCreationStateAction, prepareConversationCreationAction } from "../actions/conversation-creation.actions";
import type { ConfirmConversationCreationInput, ConversationClientChoice, ConversationCreationState } from "../types/conversation-creation.types";

export default function useConversationCreation({ conversationId, recover, completed = false, onStateChange, onChanged }: {
  conversationId: string; recover: boolean; completed?: boolean;
  onStateChange: (state: ConversationCreationState) => void;
  onChanged: () => void | Promise<void>;
}) {
  const t = useTranslations("conversationCreation");
  const [state, setState] = useState<ConversationCreationState | null>(null);
  const [active, setActive] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [expired, setExpired] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const busy = useRef(false);
  const locked = useRef(false);
  const committed = useRef(false);
  const recovered = useRef<string | null>(null);
  const attempt = useRef<ConfirmConversationCreationInput | null>(null);
  const callbacks = useRef({ onStateChange, onChanged });
  useEffect(() => { callbacks.current = { onStateChange, onChanged }; }, [onStateChange, onChanged]);
  const errorFor = useCallback((code: string) => t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.INTERNAL_ERROR"), [t]);
  const accept = useCallback((next: ConversationCreationState) => {
    setState(next);
    setExpired(!!next.preview && new Date(next.preview.expiresAt).getTime() <= Date.now());
    setAcknowledged(false);
    committed.current = !!next.result;
    callbacks.current.onStateChange(next);
  }, []);
  const changed = useCallback(async () => {
    try { await callbacks.current.onChanged(); } catch { /* A refresh cannot undo a committed operation. */ }
  }, []);

  useEffect(() => {
    if (!state?.preview) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, new Date(state.preview.expiresAt).getTime() - Date.now()));
    return () => clearTimeout(timer);
  }, [state?.preview]);

  const start = useCallback(async (autoPrepare = true) => {
    if (busy.current || locked.current || committed.current) return;
    busy.current = true;
    setLoading(true); setError(null); setActive(true);
    try {
      const response = await getConversationCreationStateAction({ conversationId });
      if (!response.success) { setError(errorFor(response.error.code)); return; }
      accept(response.data);
      if (autoPrepare && !response.data.result && !response.data.preview && response.data.status === "ready" && response.data.revisionId && !response.data.duplicates.length) {
        const prepared = await prepareConversationCreationAction({ conversationId, revisionId: response.data.revisionId,
          expectedVersion: response.data.version, choice: { kind: "new" } });
        if (!prepared.success) setError(errorFor(prepared.error.code));
        else { accept(prepared.data); await changed(); }
      }
    } catch { setError(errorFor("INTERNAL_ERROR")); }
    finally { busy.current = false; setLoading(false); }
  }, [conversationId, accept, changed, errorFor]);

  useEffect(() => {
    const key = completed ? "completed" : "pending";
    if (!recover) { recovered.current = null; return; }
    if (recovered.current === key || isLoading || uncertain || state?.result || (!completed && (state || active))) return;
    const timer = setTimeout(() => { recovered.current = key; void start(false); }, 0);
    return () => clearTimeout(timer);
  }, [recover, completed, state, active, start, isLoading, uncertain]);

  const prepare = useCallback(async (choice: ConversationClientChoice) => {
    if (busy.current || locked.current || committed.current || !state?.revisionId) return;
    busy.current = true; setLoading(true); setError(null);
    try {
      const response = await prepareConversationCreationAction({ conversationId, revisionId: state.revisionId, expectedVersion: state.version, choice });
      if (!response.success) { setError(errorFor(response.error.code)); setExpired(true); }
      else { accept(response.data); await changed(); }
    } catch { setError(errorFor("INTERNAL_ERROR")); setExpired(true); }
    finally { busy.current = false; setLoading(false); }
  }, [conversationId, state, accept, changed, errorFor]);

  const abandon = useCallback(async () => {
    if (busy.current || locked.current || committed.current) return;
    if (!state?.preview && state?.status !== "record_plan_pending") { setActive(false); setState(null); setError(null); return; }
    busy.current = true; setLoading(true); setError(null);
    try {
      const response = await abandonConversationCreationAction({ conversationId, expectedVersion: state!.version });
      if (!response.success) setError(errorFor(response.error.code));
      else { accept(response.data); setActive(!!response.data.result); if (!response.data.result) setState(null); await changed(); }
    } catch { setError(errorFor("INTERNAL_ERROR")); }
    finally { busy.current = false; setLoading(false); }
  }, [conversationId, state, accept, changed, errorFor]);

  const acknowledge = useCallback((value: boolean) => { if (!busy.current && !locked.current) setAcknowledged(value); }, []);
  const confirm = useCallback(async () => {
    const preview = state?.preview;
    const needsAcknowledgment = preview?.choice.kind === "new" && preview.duplicates.length > 0;
    if (!preview || busy.current || committed.current || (!locked.current && (expired || (needsAcknowledgment && !acknowledged)))) return;
    if (!locked.current) attempt.current = { planId: preview.planId, planHash: preview.planHash, acknowledgeDuplicates: acknowledged };
    const wasUncertain = locked.current;
    busy.current = true; locked.current = true; setLoading(true); setError(null);
    try {
      const response = await confirmConversationCreationAction(attempt.current!);
      if (response.success) {
        committed.current = true; locked.current = false; setUncertain(false);
        accept({ ...state!, status: "completed", preview: null, result: response.data });
        await changed();
      } else {
        const definitive = ["PLAN_STALE", "PLAN_EXPIRED", "DUPLICATES_CHANGED", "CLIENT_CHANGED", "PROPOSAL_NOT_READY", "STALE_VERSION", "DUPLICATE_ACKNOWLEDGMENT_REQUIRED"].includes(response.error.code);
        const preflight = ["VALIDATION_ERROR", "UNAUTHENTICATED", "ACCOUNT_INACTIVE", "FORBIDDEN", "NOT_FOUND", "SENSITIVE_DATA"].includes(response.error.code);
        const safeFailure = definitive || (!wasUncertain && preflight);
        locked.current = !safeFailure; setUncertain(!safeFailure);
        if (definitive) setExpired(true);
        setError(errorFor(wasUncertain && response.error.code === "UNAUTHENTICATED" ? "CONFIRMATION_REAUTHENTICATE" : safeFailure ? response.error.code : "CONFIRMATION_UNCERTAIN"));
      }
    } catch { setUncertain(true); setError(errorFor("CONFIRMATION_UNCERTAIN")); }
    finally { busy.current = false; setLoading(false); }
  }, [state, acknowledged, expired, accept, changed, errorFor]);

  return { state, active, isLoading, uncertain, expired, acknowledged, error, start, prepare, abandon, acknowledge, confirm };
}
