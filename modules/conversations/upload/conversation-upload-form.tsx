"use client";

import { FileAudio } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormContext } from "react-hook-form";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import { RHFFileUpload } from "@/components/form/rhf-components/rhf-file-upload/rhf-file-upload";
import { RHFSelectField } from "@/components/form/rhf-components/rhf-select-field/rhf-select-field";
import FormActionFooter from "@/components/form/components/form-action-footer";
import type { ConversationUploadPolicy } from "../lib/types/conversation.types";
import type { ConversationUploadSchema } from "./schemas/conversation-upload-schema";
import { conversationAudioAccept } from "./schemas/conversation-upload-schema";
import type { ConversationUploadStage } from "./use-conversation-upload";

export default function ConversationUploadForm({ stage, progress, error, onCancel, canCancel, canRetry, policy }: {
  stage: ConversationUploadStage; progress: number; error: string | null; onCancel: () => void; canCancel: boolean; canRetry: boolean; policy: ConversationUploadPolicy;
}) {
  const t = useTranslations("conversationUpload");
  const { formState } = useFormContext<ConversationUploadSchema>();
  const loading = stage === "preparing" || stage === "uploading" || stage === "verifying" || stage === "discarding";
  const stageLabel = t(`stages.${stage}`);
  return <div className="flex h-full flex-col">
    <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
      {error && <AlertComponent title={error} variant="destructive" />}
      <fieldset disabled={loading || formState.isSubmitting || canRetry} className="space-y-5">
        <RHFFileUpload name="file" label={t("fileLabel")} maxSize={policy.maximumBytes}
          accept={conversationAudioAccept(policy.permittedMimeTypes)} loading={loading} progress={stage === "uploading" ? progress : undefined}
          icon={<FileAudio className="h-7 w-7 text-primary" aria-hidden />} description={t("consentHint")}
          messages={{ choose: t("choose"), drop: t("drop"), acceptedTypes: t("acceptedTypes", {
            maxSize: Math.ceil(policy.maximumBytes / 1024 / 1024), maxDuration: Math.ceil(policy.maximumDurationMs / 60000),
          }), processing: stageLabel,
            remove: t("remove"), selected: t("selected"), size: (size) => t("size", { size }),
            rejectedType: t("validation.unsupportedFile"), rejectedSize: t("validation.fileTooLarge"),
            rejectedOther: t("validation.fileRequired"), progress: (value) => t("progress", { value }) }} />
        <RHFSelectField name="locale" label={t("localeLabel")} placeholder={t("localePlaceholder")}
          options={[{ value: "en", label: t("locales.en") }, { value: "es", label: t("locales.es") }]} disabled={loading} />
      </fieldset>
      {stage === "uploading" && canCancel && <Button type="button" variant="destructive" onClick={onCancel}>{t("cancelUpload")}</Button>}
    </div>
    <FormActionFooter loading={loading} onCancel={onCancel} cancelButtonText={t("cancel")}
      submitButtonText={t(canRetry ? "retry" : "submit")} loadingText={stageLabel} />
  </div>;
}
