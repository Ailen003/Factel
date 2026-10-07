"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getConversationByIdAction } from "../lib/actions/conversation.actions";
import type { ConversationDetails } from "../lib/types/conversation.types";

const POLL_INTERVAL_MS = 3_000;
const ACTIVE_STATUSES = new Set(["queued", "transcribing", "diarizing", "extracting", "validating"]);

export default function useConversationDetails(conversationId: string) {
  const t = useTranslations("conversations");
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const load = useCallback(async (quiet = false) => {
    const version = ++request.current;
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const response = await getConversationByIdAction(conversationId);
      if (version !== request.current) return;
      if (response.success) setConversation(response.data);
      else setError(t.has(`errors.${response.error.code}`) ? t(`errors.${response.error.code}`) : t("errors.INTERNAL_ERROR"));
    } catch { if (version === request.current) setError(t("errors.INTERNAL_ERROR")); }
    finally { if (version === request.current) setLoading(false); }
  }, [conversationId, t]);
  useEffect(() => {
    const activeRequest = request;
    const timer = setTimeout(() => { void load(); }, 0);
    return () => { clearTimeout(timer); activeRequest.current++; };
  }, [load]);
  useEffect(() => {
    const awaitingExtraction = conversation?.status === "transcribed"
      && (conversation.processingRun?.status === "accepted" || conversation.processingRun?.status === "running");
    if (!conversation || (!ACTIVE_STATUSES.has(conversation.status) && !awaitingExtraction)) return;
    const timer = window.setInterval(() => { void load(true); }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [conversation, load]);
  return { conversation, isLoading, error, reload: load };
}
