"use client";

import { useCallback, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ConversationDetails } from "../lib/types/conversation.types";
import ConversationStatusBadge from "../components/conversation-status-badge";
import ConversationProcessingPanel from "../processing/conversation-processing-panel";
import ConversationTranscriptView from "../processing/conversation-transcript-view";
import { getConversationProcessingView } from "../processing/conversation-processing-view";
import ConversationReviewContainer, { type ReviewGuard } from "../review/conversation-review-container";

const noop = () => undefined;

function formatDuration(durationMs: number | null | undefined) {
  if (durationMs == null) return null;
  const seconds = Math.floor(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function ConversationDetailsPresentational({ conversation, onProcess, isStarting, startError, onContinue, onReviewChanged = noop, onGuardChange }: {
  conversation: ConversationDetails;
  onProcess: () => void;
  isStarting: boolean;
  startError: string | null;
  onContinue?: () => void;
  onReviewChanged?: () => void | Promise<void>;
  onGuardChange?: (guard: ReviewGuard) => void;
}) {
  const t = useTranslations("conversations");
  const details = useTranslations("conversationDetails");
  const review = useTranslations("conversationReview");
  const format = useFormatter();
  const [audioRevision, setAudioRevision] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [tab, setTab] = useState(() => ["needs_review", "ready", "record_plan_pending", "completed"].includes(conversation.status) ? "review" : "information");
  const audioRef = useRef<HTMLAudioElement>(null);
  const seek = useCallback((startMs: number) => {
    const player = audioRef.current;
    if (!player || !Number.isFinite(startMs) || startMs < 0 || player.readyState < 1) return;
    const seconds = startMs / 1000;
    if (Number.isFinite(player.duration) && seconds > player.duration) return;
    try { player.currentTime = seconds; void player.play().catch(() => setAudioError(true)); }
    catch { setAudioError(true); }
  }, []);
  const processing = getConversationProcessingView(conversation);
  const fields = [
    ["source", t(`sources.${conversation.sourceType}`)],
    ["locale", t(`locales.${conversation.locale}`)],
    ["duration", formatDuration(conversation.durationMs) ?? t("notAvailable")],
    ["createdAt", format.dateTime(new Date(conversation.createdAt), { dateStyle: "medium", timeStyle: "short" })],
    ["updatedAt", format.dateTime(new Date(conversation.updatedAt), { dateStyle: "medium", timeStyle: "short" })],
  ] as const;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-2">
      <ConversationStatusBadge status={conversation.status} />
      {conversation.audio && <Badge variant="outline">{details("verification", { state: details(`verificationStates.${conversation.audio.verificationState}`) })}</Badge>}
    </div>
    <ConversationProcessingPanel view={processing} onProcess={onProcess} onContinue={onContinue} isStarting={isStarting} startError={startError} />
    {conversation.audio?.playbackPath && <section className="space-y-3" aria-labelledby="conversation-audio-title">
      <h3 id="conversation-audio-title" className="text-sm font-medium">{details("audio")}</h3>
      {audioError && <div className="space-y-2">
        <AlertComponent variant="destructive" title={details("audioError")} />
        <Button variant="outline" size="sm" onClick={() => { setAudioError(false); setAudioRevision((value) => value + 1); }}>
          {details("retryAudio")}
        </Button>
      </div>}
      <audio ref={audioRef} key={audioRevision} className="w-full" controls preload="metadata" src={conversation.audio.playbackPath}
        onError={() => setAudioError(true)} onCanPlay={() => setAudioError(false)}>
        {details("audioUnsupported")}
      </audio>
    </section>}
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList aria-label={details("tabs.label")}>
        <TabsTrigger value="information">{details("tabs.information")}</TabsTrigger>
        <TabsTrigger value="transcript">{details("tabs.transcript")}</TabsTrigger>
        <TabsTrigger value="review">{review("tab")}</TabsTrigger>
      </TabsList>
      <TabsContent value="information" className="space-y-6 pt-4">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map(([field, value]) => <div key={field}>
            <dt className="text-sm font-medium text-muted-foreground">{t(`fields.${field}`)}</dt>
            <dd className="mt-1 break-words text-sm">{value}</dd>
          </div>)}
          {conversation.originalFilename && <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-muted-foreground">{details("originalFilename")}</dt>
            <dd className="mt-1 break-all text-sm">{conversation.originalFilename}</dd>
          </div>}
          {conversation.audio?.verifiedMimeType && <div>
            <dt className="text-sm font-medium text-muted-foreground">{details("mimeType")}</dt>
            <dd className="mt-1 break-all text-sm">{conversation.audio.verifiedMimeType}</dd>
          </div>}
          {conversation.audio?.verifiedContainer && <div>
            <dt className="text-sm font-medium text-muted-foreground">{details("container")}</dt>
            <dd className="mt-1 break-all text-sm">{conversation.audio.verifiedContainer.toUpperCase()}</dd>
          </div>}
          {conversation.audio?.byteSize != null && <div>
            <dt className="text-sm font-medium text-muted-foreground">{details("fileSize")}</dt>
            <dd className="mt-1 text-sm">{details("megabytes", { value: format.number(conversation.audio.byteSize / 1024 / 1024, { maximumFractionDigits: 2 }) })}</dd>
          </div>}
        </dl>
      </TabsContent>
      <TabsContent value="review" forceMount hidden={tab !== "review"} className="pt-4 data-[state=inactive]:hidden">
        <ConversationReviewContainer conversation={conversation} onChanged={onReviewChanged} onGuardChange={onGuardChange} onSeek={seek} />
      </TabsContent>
      <TabsContent value="transcript" className="pt-4">
        {conversation.transcript
          ? <ConversationTranscriptView transcript={conversation.transcript} />
          : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{details("transcriptPending")}</p>}
      </TabsContent>
    </Tabs>
  </div>;
}
