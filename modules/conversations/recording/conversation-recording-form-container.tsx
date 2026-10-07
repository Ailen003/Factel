"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { FormProvider, useForm } from "react-hook-form";
import { ConfirmationDialog } from "@/components/confirmation-dialog/confirmation-dialog";
import type { ConversationMutationResult, ConversationUploadPolicy } from "../lib/types/conversation.types";
import useConversationUpload from "../upload/use-conversation-upload";
import ConversationRecordingForm from "./conversation-recording-form";
import {
  conversationRecordingSchemaFactory,
  type ConversationRecordingSchema,
} from "./schemas/conversation-recording-schema";
import useConversationRecorder from "./use-conversation-recorder";

interface Props {
  routeLocale: string;
  policy: ConversationUploadPolicy;
  onClose: () => void;
  onSuccess: (result: ConversationMutationResult) => void;
  onLockChange: (locked: boolean) => void;
  onUnsavedChange: (unsaved: boolean) => void;
}

export default function ConversationRecordingFormContainer({
  routeLocale,
  policy,
  onClose,
  onSuccess,
  onLockChange,
  onUnsavedChange,
}: Props) {
  const t = useTranslations("conversationRecording");
  const validationT = useTranslations("conversationRecording.validation");
  const defaultLocale = routeLocale === "es" ? "es" : "en";
  const form = useForm<ConversationRecordingSchema>({
    resolver: zodResolver(conversationRecordingSchemaFactory({
      consentRequired: validationT("consentRequired"),
      localeRequired: validationT("localeRequired"),
    })),
    defaultValues: { consent: false, locale: defaultLocale },
  });
  const recorder = useConversationRecorder(policy);
  const [uploadLocked, setUploadLocked] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const handleSuccess = useCallback((result: ConversationMutationResult) => {
    recorder.discard();
    onSuccess(result);
  }, [onSuccess, recorder]);
  const upload = useConversationUpload({
    onSuccess: handleSuccess,
    onLockChange: setUploadLocked,
    policy,
    sourceType: "microphone",
  });
  const locked = recorder.locked || uploadLocked;
  const unsaved = recorder.hasUnsavedRecording;

  useEffect(() => { onLockChange(locked); }, [locked, onLockChange]);
  useEffect(() => { onUnsavedChange(unsaved); }, [onUnsavedChange, unsaved]);
  useEffect(() => {
    if (!locked && !unsaved) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [locked, unsaved]);

  const reset = useCallback(() => {
    recorder.discard();
    upload.reset();
    form.reset({ consent: false, locale: defaultLocale });
  }, [defaultLocale, form, recorder, upload]);

  const discard = useCallback(async () => {
    setDiscarding(true);
    try {
      if (upload.canCancel && !(await upload.cancel())) return;
      reset();
      setDiscardOpen(false);
    } finally {
      setDiscarding(false);
    }
  }, [reset, upload]);

  const save = useCallback(async () => {
    if (!recorder.file) return;
    if (upload.canRetry) await upload.retry();
    else await upload.submit({ file: recorder.file, locale: form.getValues("locale") });
  }, [form, recorder.file, upload]);

  const submit = useMemo(() => form.handleSubmit(async () => recorder.start()), [form, recorder]);

  return <FormProvider {...form}>
    <form noValidate onSubmit={submit} className="h-full">
      <ConversationRecordingForm
        stage={recorder.stage}
        elapsedMs={recorder.elapsedMs}
        activity={recorder.activity}
        previewUrl={recorder.previewUrl}
        file={recorder.file}
        error={recorder.error}
        notice={recorder.notice}
        policy={policy}
        uploadStage={upload.stage}
        uploadProgress={upload.progress}
        uploadError={upload.error}
        canRetryUpload={upload.canRetry}
        onStop={recorder.stop}
        onReset={reset}
        onSave={save}
        onRequestDiscard={() => setDiscardOpen(true)}
        onCancel={onClose}
      />
    </form>
    <ConfirmationDialog open={discardOpen} onOpenChange={setDiscardOpen}
      title={t("discardTitle")} description={t("discardDescription")}
      confirmLabel={t("discardConfirm")} cancelLabel={t("keepRecording")}
      onConfirm={discard} isLoading={discarding} variant="destructive" />
  </FormProvider>;
}
