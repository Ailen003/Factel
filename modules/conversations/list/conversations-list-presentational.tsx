"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ServiceResponse } from "@/lib/api-responses";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/confirmation-dialog/confirmation-dialog";
import { Modal } from "@/components/modal/modal";
import type { ConversationsResponse } from "../lib/types/conversation.types";
import ConversationDetailsContainer from "../details/conversation-details-container";
import useDeleteConversation from "../delete/use-delete-conversation";
import ConversationsListCardsView from "./conversations-list-cards-view";
import ConversationsListTableView from "./conversations-list-table-view";
import { useDeleteConversationListAction, useViewConversationListAction } from "./hooks";
import type { ReviewGuard } from "../review/conversation-review-container";

export default function ConversationsListPresentational({ response }: { response: ServiceResponse<ConversationsResponse> }) {
  const t = useTranslations("conversations");
  const details = useTranslations("conversationDetails");
  const review = useTranslations("conversationReview");
  const router = useRouter();
  const view = useViewConversationListAction();
  const deletion = useDeleteConversationListAction();
  const [reviewGuard, setReviewGuard] = useState<ReviewGuard>({ dirty: false, busy: false });
  const [discardOpen, setDiscardOpen] = useState(false);
  const closeDetails = useCallback(() => {
    setDiscardOpen(false);
    setReviewGuard({ dirty: false, busy: false });
    view.handleModalOpenChange(false);
  }, [view]);
  const changeDetailsOpen = useCallback((open: boolean) => {
    if (open) { view.handleModalOpenChange(true); return; }
    if (reviewGuard.busy) return;
    if (reviewGuard.dirty) { setDiscardOpen(true); return; }
    closeDetails();
  }, [reviewGuard, view, closeDetails]);
  const deletingConversation = response.success
    ? response.data.conversations.find((item) => item.id === deletion.deletingItemId)
    : undefined;
  const deleted = useCallback(() => {
    toast.success(t("delete.success"), { position: "top-right" });
    deletion.handleCloseDeleteDialog();
    setTimeout(() => router.refresh(), 300);
  }, [deletion, router, t]);
  const mutation = useDeleteConversation(deleted);
  const changeDeleteOpen = useCallback((open: boolean) => {
    if (!open && !mutation.isLoading) {
      mutation.reset();
      deletion.handleDeleteDialogOpenChange(false);
    }
  }, [deletion, mutation]);
  if (!response.success) return <div className="space-y-3">
    <AlertComponent variant="destructive" title={t.has(`errors.${response.error.code}`) ? t(`errors.${response.error.code}`) : t("errors.INTERNAL_ERROR")} />
    <Button variant="outline" onClick={() => router.refresh()}>{t("retry")}</Button>
  </div>;
  return <div className="pb-4">
    <div className="hidden md:block"><ConversationsListTableView conversations={response.data.conversations} onView={view.handleViewItem} onDelete={deletion.handleDeleteItem} /></div>
    <div className="block md:hidden"><ConversationsListCardsView conversations={response.data.conversations} onView={view.handleViewItem} onDelete={deletion.handleDeleteItem} /></div>
    <Modal open={view.isModalOpen} onOpenChange={changeDetailsOpen} title={details("title")}
      description={details("description")} closeLabel={t("close")} maxWidth="5xl" maxHeight="lg">
      {view.viewingItemId && <ConversationDetailsContainer key={view.viewingItemId} conversationId={view.viewingItemId} onGuardChange={setReviewGuard} />}
    </Modal>
    <ConfirmationDialog open={discardOpen} onOpenChange={setDiscardOpen} title={review("discardTitle")} description={review("discardDescription")}
      confirmLabel={review("discardClose")} cancelLabel={review("keepEditing")} onConfirm={closeDetails} />
    {deletingConversation && <ConfirmationDialog open={deletion.isDeleteDialogOpen} onOpenChange={changeDeleteOpen}
      title={details("deleteTitle")} description={details("deleteDescription")} confirmLabel={details("deleteConfirm")}
      cancelLabel={details("cancel")} onConfirm={() => mutation.execute(deletingConversation.id, deletingConversation.version)}
      isLoading={mutation.isLoading} error={mutation.error} variant="destructive" />}
  </div>;
}
