"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LoadingDataSpinner } from "@/components/ui/loading-data-spinner";
import ConversationDetailsPresentational from "./conversation-details-presentational";
import useConversationDetails from "./use-conversation-details";
import useStartConversationProcessing from "../processing/use-start-conversation-processing";
import useContinueConversationExtraction from "../processing/use-continue-conversation-extraction";
import type { ReviewGuard } from "../review/conversation-review-container";

const ACTIVE_STATUSES = new Set(["queued", "transcribing", "diarizing", "extracting", "validating"]);
const REFRESH_STATUSES = new Set(["transcribed", "needs_review", "ready", "failed", "cancelled"]);

export default function ConversationDetailsContainer({ conversationId, onGuardChange }: { conversationId: string; onGuardChange?: (guard: ReviewGuard) => void }) {
  const t = useTranslations("conversationDetails");
  const router = useRouter();
  const { conversation, isLoading, error, reload } = useConversationDetails(conversationId);
  const previousStatus = useRef<string | null>(null);
  const reloadAfterStart = useCallback(() => reload(true), [reload]);
  const processing = useStartConversationProcessing(reloadAfterStart);
  const extraction = useContinueConversationExtraction(reloadAfterStart);
  const reviewChanged = useCallback(async () => { await reload(true); router.refresh(); }, [reload, router]);
  useEffect(() => {
    const current = conversation?.status ?? null;
    if (current && REFRESH_STATUSES.has(current) && previousStatus.current && ACTIVE_STATUSES.has(previousStatus.current)) {
      router.refresh();
    }
    previousStatus.current = current;
  }, [conversation?.status, router]);
  if (isLoading && !conversation) return <LoadingDataSpinner loadingText={t("loading")} loadingSubtitle={t("loadingSubtitle")} />;
  if (!conversation) return <div className="space-y-4 py-8 text-center">
    <p className="text-destructive" role="alert">{error ?? t("notFound")}</p>
    <Button variant="outline" onClick={() => void reload()}>{t("retry")}</Button>
  </div>;
  return <>{error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}<ConversationDetailsPresentational conversation={conversation}
    onProcess={() => void processing.execute(conversation.id, conversation.version)}
    isStarting={processing.isLoading || extraction.isLoading} startError={processing.error || extraction.error}
    onContinue={() => void extraction.execute(conversation.id, conversation.version)}
    onReviewChanged={reviewChanged} onGuardChange={onGuardChange} /></>;
}
