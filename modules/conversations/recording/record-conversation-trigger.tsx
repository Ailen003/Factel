"use client";

import { useCallback, useState } from "react";
import { Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/confirmation-dialog/confirmation-dialog";
import { Modal } from "@/components/modal/modal";
import { Button } from "@/components/ui/button";
import type { ConversationMutationResult, ConversationUploadPolicy } from "../lib/types/conversation.types";
import ConversationRecordingFormContainer from "./conversation-recording-form-container";

export default function RecordConversationTrigger({ routeLocale, policy }: {
  routeLocale: string;
  policy: ConversationUploadPolicy | null;
}) {
  const t = useTranslations("conversationRecording");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setLocked(false);
    setUnsaved(false);
  }, []);
  const requestClose = useCallback(() => {
    if (locked) return;
    if (unsaved) setCloseConfirmationOpen(true);
    else close();
  }, [close, locked, unsaved]);
  const success = useCallback((_result: ConversationMutationResult) => {
    toast.success(t("success"), { position: "top-right" });
    close();
    setTimeout(() => router.refresh(), 300);
  }, [close, router, t]);

  return <>
    <Button onClick={() => setOpen(true)} disabled={!policy} title={!policy ? t("unavailable") : undefined}>
      <Mic className="h-4 w-4" aria-hidden />{t("trigger")}
    </Button>
    <Modal open={open} onOpenChange={(next) => next ? setOpen(true) : requestClose()}
      title={t("title")} description={t("description")} closeLabel={t("close")}
      maxWidth="2xl" maxHeight="lg" bodyClassName="px-0 py-0"
      showCloseButton={!locked} closeOnOverlayClick={!locked}>
      {open && policy && <ConversationRecordingFormContainer routeLocale={routeLocale} policy={policy}
        onClose={requestClose} onSuccess={success} onLockChange={setLocked} onUnsavedChange={setUnsaved} />}
    </Modal>
    <ConfirmationDialog open={closeConfirmationOpen} onOpenChange={setCloseConfirmationOpen}
      title={t("discardTitle")} description={t("closeDiscardDescription")}
      confirmLabel={t("discardConfirm")} cancelLabel={t("keepRecording")}
      onConfirm={() => { setCloseConfirmationOpen(false); close(); }} variant="destructive" />
  </>;
}
