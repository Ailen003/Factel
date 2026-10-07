"use client";

import { useCallback, useState } from "react";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal/modal";
import type { ConversationMutationResult, ConversationUploadPolicy } from "../lib/types/conversation.types";
import ConversationUploadFormContainer from "./conversation-upload-form-container";

export default function CreateConversationTrigger({ routeLocale, policy }: { routeLocale: string; policy: ConversationUploadPolicy | null }) {
  const t = useTranslations("conversationUpload");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const requestClose = useCallback(() => { if (!locked) setOpen(false); }, [locked]);
  const success = useCallback((_result: ConversationMutationResult) => {
    toast.success(t("success"), { position: "top-right" });
    setOpen(false);
    setTimeout(() => router.refresh(), 300);
  }, [router, t]);
  return <>
    <Button onClick={() => setOpen(true)} disabled={!policy} title={!policy ? t("unavailable") : undefined}><Upload className="h-4 w-4" />{t("trigger")}</Button>
    <Modal open={open} onOpenChange={(next) => next ? setOpen(true) : requestClose()} title={t("title")} description={t("description")}
      closeLabel={t("close")} maxWidth="2xl" maxHeight="lg" bodyClassName="px-0 py-0" showCloseButton={!locked} closeOnOverlayClick={!locked}>
      {open && policy && <ConversationUploadFormContainer routeLocale={routeLocale} policy={policy} onClose={close} onSuccess={success} onLockChange={setLocked} />}
    </Modal>
  </>;
}
