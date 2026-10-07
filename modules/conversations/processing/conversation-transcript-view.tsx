"use client";

import { useFormatter, useTranslations } from "next-intl";
import { AlertComponent } from "@/components/ui/alert-component";
import { Badge } from "@/components/ui/badge";
import type { ConversationDetails } from "../lib/types/conversation.types";

function formatTime(value: number | null) {
  if (value == null) return null;
  const totalSeconds = Math.floor(value / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function speakerName(speakerId: string, label: (value: string) => string) {
  const suffix = speakerId.replace(/^speaker_/i, "").replaceAll("_", " ").toUpperCase();
  return label(suffix || speakerId);
}

export default function ConversationTranscriptView({ transcript }: { transcript: NonNullable<ConversationDetails["transcript"]> }) {
  const t = useTranslations("conversationTranscript");
  const format = useFormatter();
  const diarizationUnavailable = transcript.diarizationStatus === "unavailable" || transcript.diarizationStatus === "failed";

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <Badge variant="outline">{t(`locales.${transcript.locale}`)}</Badge>
      <span>{t("completedAt", { date: format.dateTime(new Date(transcript.completedAt), { dateStyle: "medium", timeStyle: "short" }) })}</span>
    </div>

    {(diarizationUnavailable || transcript.warningCode) && <AlertComponent title={t("warnings.title")} description={
      transcript.warningCode && t.has(`warnings.${transcript.warningCode}`)
        ? t(`warnings.${transcript.warningCode}`)
        : t("warnings.diarizationUnavailable")
    } />}

    <section className="space-y-2" aria-labelledby="original-transcript-title">
      <h3 id="original-transcript-title" className="font-medium">{t("original")}</h3>
      <p className="whitespace-pre-wrap break-words rounded-lg border bg-muted/20 p-4 text-sm leading-6">{transcript.text}</p>
    </section>

    <section className="space-y-3" aria-labelledby="transcript-segments-title">
      <div>
        <h3 id="transcript-segments-title" className="font-medium">{t("segments.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("segments.description")}</p>
      </div>
      {transcript.segments.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {t("segments.empty")}
      </p> : <ol className="space-y-3">
        {transcript.segments.map((segment) => {
          const start = formatTime(segment.startMs);
          const end = formatTime(segment.endMs);
          return <li key={segment.id} className="rounded-lg border p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {segment.speakerId
                ? <Badge variant="secondary">{speakerName(segment.speakerId, (speaker) => t("segments.speaker", { speaker }))}</Badge>
                : <Badge variant="outline">{t("segments.evidence")}</Badge>}
              {start && end && <span>{t("segments.timeRange", { start, end })}</span>}
              {segment.confidence != null && <span>{t("segments.confidence", {
                value: format.number(segment.confidence, { style: "percent", maximumFractionDigits: 0 }),
              })}</span>}
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{segment.text}</p>
          </li>;
        })}
      </ol>}
    </section>
  </div>;
}
