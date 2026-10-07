"use client";

import { useTranslations } from "next-intl";
import { AlertComponent } from "@/components/ui/alert-component";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ConversationProcessingView } from "./conversation-processing-view";

const STAGE_PROGRESS: Record<string, number> = {
  queued: 15,
  transcribing: 50,
  diarizing: 80,
  extracting: 90,
  validating: 95,
  publishing: 98,
};

export default function ConversationProcessingPanel({ view, onProcess, onContinue, isStarting, startError }: {
  view: ConversationProcessingView;
  onProcess: () => void;
  isStarting: boolean;
  startError: string | null;
  onContinue?: () => void;
}) {
  const t = useTranslations("conversationProcessing");
  const review = useTranslations("conversationReview");
  const run = view.run;
  const active = run && (run.status === "accepted" || run.status === "running");
  const progress = run ? STAGE_PROGRESS[run.stage] ?? 0 : 0;

  return <section className="space-y-4 rounded-lg border bg-muted/20 p-4" aria-labelledby="processing-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 id="processing-title" className="font-medium">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      {view.canStart && <Button onClick={onProcess} disabled={isStarting} aria-busy={isStarting}>
        {isStarting ? t("starting") : t("start")}
      </Button>}
      {view.canContinue && onContinue && <Button onClick={onContinue} disabled={isStarting} aria-busy={isStarting}>
        {isStarting ? review("continuing") : review("continueExtraction")}
      </Button>}
    </div>

    <dl className="grid grid-cols-3 gap-2" aria-label={t("credits.title")}>
      {(["available", "reserved", "consumed"] as const).map((kind) => <div key={kind} className="rounded-md bg-background p-3 text-center">
        <dt className="text-xs text-muted-foreground">{t(`credits.${kind}`)}</dt>
        <dd className="mt-1 text-lg font-semibold tabular-nums">{view.credits[kind]}</dd>
      </div>)}
    </dl>

    {startError && <AlertComponent variant="destructive" title={startError} />}

    {run && <div className="space-y-2" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>{t("currentStage")}</span>
        <Badge variant={run.status === "failed" ? "destructive" : "secondary"}>
          {t.has(`stages.${run.stage}`) ? t(`stages.${run.stage}`) : run.stage}
        </Badge>
      </div>
      {active && <Progress value={progress} aria-label={t("progress", { stage: t(`stages.${run.stage}`) })} />}
      {run.failureCode && <AlertComponent variant="destructive" title={
        t.has(`errors.${run.failureCode}`) ? t(`errors.${run.failureCode}`) : t("errors.PROCESSING_FAILED")
      } description={view.hasPreservedReview ? t("preservedReviewFailure") : run.retryable ? t("retryable") : t("notRetryable")} />}
    </div>}

    {!view.canStart && !active && !view.transcript && <p className="text-sm text-muted-foreground">
      {view.credits.available < 1 ? t("noCredits") : t("unavailable")}
    </p>}
  </section>;
}
