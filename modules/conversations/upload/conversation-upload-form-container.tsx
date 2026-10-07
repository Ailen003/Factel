"use client";

import { useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { FormProvider, useForm } from "react-hook-form";
import type { ConversationMutationResult, ConversationUploadPolicy } from "../lib/types/conversation.types";
import ConversationUploadForm from "./conversation-upload-form";
import { conversationUploadSchemaFactory, type ConversationUploadSchema } from "./schemas/conversation-upload-schema";
import useConversationUpload from "./use-conversation-upload";

export default function ConversationUploadFormContainer({ routeLocale, policy, onClose, onSuccess, onLockChange }: {
  routeLocale: string; policy: ConversationUploadPolicy; onClose: () => void; onSuccess: (result: ConversationMutationResult) => void; onLockChange: (locked: boolean) => void;
}) {
  const t = useTranslations("conversationUpload.validation");
  const form = useForm<ConversationUploadSchema>({
    resolver: zodResolver(conversationUploadSchemaFactory({ fileRequired: t("fileRequired"), fileTooLarge: t("fileTooLarge"),
      unsupportedFile: t("unsupportedFile"), localeRequired: t("localeRequired") }, policy.maximumBytes, policy.permittedMimeTypes)),
    defaultValues: { file: undefined, locale: routeLocale === "es" ? "es" : "en" },
  });
  const upload = useConversationUpload({ onSuccess, onLockChange, policy });
  const cancel = useCallback(async () => {
    if (upload.canCancel) { if (await upload.cancel()) onClose(); }
    else if (!upload.locked) { upload.reset(); onClose(); }
  }, [onClose, upload]);
  return <FormProvider {...form}>
    <form noValidate onSubmit={form.handleSubmit(upload.canRetry ? upload.retry : upload.submit)} className="h-full">
      <ConversationUploadForm stage={upload.stage} progress={upload.progress} error={upload.error} onCancel={cancel}
        canCancel={upload.canCancel} canRetry={upload.canRetry} policy={policy} />
    </form>
  </FormProvider>;
}
