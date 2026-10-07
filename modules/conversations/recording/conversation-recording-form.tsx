"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormContext } from "react-hook-form";
import { RHFCheckboxField } from "@/components/form/rhf-components/rhf-checkbox-field/rhf-checkbox-field";
import { RHFSelectField } from "@/components/form/rhf-components/rhf-select-field/rhf-select-field";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ConversationUploadPolicy } from "../lib/types/conversation.types";
import type { ConversationUploadStage } from "../upload/use-conversation-upload";
import type { ConversationRecordingSchema } from "./schemas/conversation-recording-schema";
import type {
  ConversationRecordingError,
  ConversationRecordingNotice,
  ConversationRecordingStage,
} from "./use-conversation-recorder";

export function formatRecordingDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

interface Props {
  stage: ConversationRecordingStage;
  elapsedMs: number;
  activity: number;
  previewUrl: string | null;
  file: File | null;
  error: ConversationRecordingError | null;
  notice: ConversationRecordingNotice | null;
  policy: ConversationUploadPolicy;
  uploadStage: ConversationUploadStage;
  uploadProgress: number;
  uploadError: string | null;
  canRetryUpload: boolean;
  onStop: () => void;
  onReset: () => void;
  onSave: () => void;
  onRequestDiscard: () => void;
  onCancel: () => void;
}

export default function ConversationRecordingForm({
  stage,
  elapsedMs,
  activity,
  previewUrl,
  file,
  error,
  notice,
  policy,
  uploadStage,
  uploadProgress,
  uploadError,
  canRetryUpload,
  onStop,
  onReset,
  onSave,
  onRequestDiscard,
  onCancel,
}: Props) {
  const t = useTranslations("conversationRecording");
  const uploadT = useTranslations("conversationUpload");
  const { formState } = useFormContext<ConversationRecordingSchema>();
  const maximumMinutes = Math.ceil(policy.maximumDurationMs / 60_000);
  const maximumMegabytes = Math.ceil(policy.maximumBytes / 1024 / 1024);
  const transferring = ["preparing", "uploading", "verifying", "discarding"].includes(uploadStage);
  const reviewing = stage === "review" && file && previewUrl;

  if (stage === "requesting" || stage === "stopping") {
    return <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 py-10 text-center" role="status" aria-live="polite">
      <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
      <div>
        <p className="font-medium">{t(`stages.${stage}`)}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t(stage === "requesting" ? "permissionPending" : "finalizingHint")}</p>
      </div>
    </div>;
  }

  if (stage === "recording") {
    return <div className="flex min-h-72 flex-col justify-between gap-8 px-6 py-8">
      <div className="space-y-7 text-center">
        <p className="sr-only" role="status" aria-live="polite">{t("active")}</p>
        <div className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-4 py-2 font-medium text-destructive">
          <span className="h-3 w-3 animate-pulse rounded-full bg-destructive" aria-hidden />
          {t("active")}
        </div>
        <div>
          <p className="font-mono text-5xl font-semibold tabular-nums">{formatRecordingDuration(elapsedMs)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("maximumDuration", { minutes: maximumMinutes })}</p>
        </div>
        <div className="mx-auto max-w-md space-y-2 text-left">
          <div className="flex justify-between text-sm">
            <span>{t("microphoneActivity")}</span>
            <span className="text-muted-foreground">{t("activityValue", { value: activity })}</span>
          </div>
          <Progress value={activity} role="meter" aria-label={t("microphoneActivity")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={activity} className="h-3" />
        </div>
      </div>
      <div className="flex justify-center border-t border-border pt-6">
        <Button type="button" variant="destructive" size="lg" onClick={onStop}>
          <Square className="h-4 w-4 fill-current" aria-hidden />{t("stop")}
        </Button>
      </div>
    </div>;
  }

  if (reviewing) {
    return <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div aria-live="polite">
          {notice && <AlertComponent title={t(`notices.${notice}.title`)} description={t(`notices.${notice}.description`)} />}
          {uploadError && <AlertComponent title={uploadError} variant="destructive" />}
        </div>
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">{t("reviewTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("recordingMetadata", {
                duration: formatRecordingDuration(elapsedMs),
                size: (file.size / 1024 / 1024).toFixed(2),
              })}</p>
            </div>
          </div>
          <audio className="w-full" controls preload="metadata" src={previewUrl}>{t("audioUnsupported")}</audio>
        </div>
        <RHFSelectField name="locale" label={t("localeLabel")} placeholder={t("localePlaceholder")}
          options={[{ value: "en", label: t("locales.en") }, { value: "es", label: t("locales.es") }]} disabled={transferring} />
        {transferring && <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex justify-between text-sm"><span>{uploadT(`stages.${uploadStage}`)}</span>{uploadStage === "uploading" && <span>{uploadProgress}%</span>}</div>
          <Progress value={uploadStage === "uploading" ? uploadProgress : undefined} />
        </div>}
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onRequestDiscard} disabled={transferring}>{t("discard")}</Button>
        <Button type="button" onClick={onSave} disabled={transferring}>
          {transferring && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {transferring ? uploadT(`stages.${uploadStage}`) : canRetryUpload ? t("retrySave") : t("save")}
        </Button>
      </div>
    </div>;
  }

  if (stage === "failed") {
    return <div className="flex min-h-72 flex-col justify-between gap-6 px-6 py-5">
      <div className="space-y-5" aria-live="assertive">
        {error && <AlertComponent title={t(`errors.${error}`)} variant="destructive" />}
        <p className="text-sm text-muted-foreground">{t("failureHint")}</p>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>{t("cancel")}</Button>
        <Button type="button" onClick={onReset}>{t("tryAgain")}</Button>
      </div>
    </div>;
  }

  return <div className="flex h-full flex-col">
    <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
      <AlertComponent title={t("consentTitle")} description={t("consentDescription")} />
      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        {t("limits", { maxSize: maximumMegabytes, maxDuration: maximumMinutes })}
      </div>
      <RHFSelectField name="locale" label={t("localeLabel")} placeholder={t("localePlaceholder")}
        options={[{ value: "en", label: t("locales.en") }, { value: "es", label: t("locales.es") }]} />
      <RHFCheckboxField name="consent" label={t("consentLabel")} description={t("consentHint")} />
    </div>
    <div className="flex flex-col-reverse gap-3 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel}>{t("cancel")}</Button>
      <Button type="submit" disabled={formState.isSubmitting}>
        <Mic className="h-4 w-4" aria-hidden />{t("start")}
      </Button>
    </div>
  </div>;
}
