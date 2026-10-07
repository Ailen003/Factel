"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ServiceResponse } from "@/lib/api-responses";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal/modal";
import { ConfirmationDialog } from "@/components/confirmation-dialog/confirmation-dialog";
import { toast } from "sonner";
import type { ClientsResponse } from "../lib/types/client.types";
import { useDeleteClientListAction, useEditClientListAction, useViewClientListAction } from "./hooks";
import ClientDetailsContainer from "../details/client-details-container";
import EditClientContainer from "../form/edit/edit-client-container";
import { useDeleteClient } from "../lib/hooks/use-delete-client";
import ClientsListTableView from "./clients-list-table-view";
import ClientsListCardsView from "./clients-list-cards-view";

export default function ClientsListPresentational({ response }: { response: ServiceResponse<ClientsResponse> }) {
  const t = useTranslations("clients");
  const details = useTranslations("clientDetails");
  const router = useRouter();
  const view = useViewClientListAction();
  const edit = useEditClientListAction();
  const deletion = useDeleteClientListAction();
  const deletingClient = response.success ? response.data.clients.find((client) => client.id === deletion.deletingItemId) : undefined;
  const deleted = useCallback(() => { toast.success(t("delete.success"), { position: "top-right" });
    deletion.handleCloseDeleteDialog(); setTimeout(() => router.refresh(), 300); }, [deletion, router, t]);
  const mutation = useDeleteClient(deleted);
  const changeDeleteOpen = useCallback((open: boolean) => { if (!open && !mutation.isLoading) {
    mutation.reset(); deletion.handleDeleteDialogOpenChange(false); } }, [deletion, mutation]);
  if (!response.success) {
    return (
      <div className="space-y-3">
        <AlertComponent
          variant="destructive"
          title={t.has(`errors.${response.error.code}`) ? t(`errors.${response.error.code}`) : t("errors.INTERNAL_ERROR")}
        />
        <Button variant="outline" onClick={() => router.refresh()}>{t("retry")}</Button>
      </div>
    );
  }
  return (
    <div className="pb-4">
      <div className="hidden md:block">
        <ClientsListTableView clients={response.data.clients} onView={view.handleViewItem} onEdit={edit.handleEditItem} onDelete={deletion.handleDeleteItem} />
      </div>
      <div className="block md:hidden">
        <ClientsListCardsView clients={response.data.clients} onView={view.handleViewItem} onEdit={edit.handleEditItem} onDelete={deletion.handleDeleteItem} />
      </div>
      <Modal
        open={view.isModalOpen}
        onOpenChange={view.handleModalOpenChange}
        title={details("title")}
        description={details("description")}
        closeLabel={t("close")}
        maxWidth="4xl"
        maxHeight="lg"
      >
        {view.viewingItemId && (
          <ClientDetailsContainer key={view.viewingItemId} clientId={view.viewingItemId} />
        )}
      </Modal>
      <Modal open={edit.isModalOpen} onOpenChange={edit.handleModalOpenChange} title={details("editTitle")}
        description={details("editDescription")} maxWidth="2xl" maxHeight="lg" bodyClassName="px-0 py-0 pb-4">
        {edit.editingItemId && <EditClientContainer key={edit.editingItemId} clientId={edit.editingItemId} onClose={edit.handleCloseModal} />}
      </Modal>
      {deletingClient && <ConfirmationDialog open={deletion.isDeleteDialogOpen} onOpenChange={changeDeleteOpen}
        title={details("deleteTitle", { name: deletingClient.name })}
        description={details("deleteDescription", { name: deletingClient.name })}
        confirmLabel={details("deleteConfirm")} cancelLabel={details("cancel")}
        onConfirm={() => mutation.execute(deletingClient.id, deletingClient.version)} isLoading={mutation.isLoading}
        error={mutation.error} variant="destructive" />}
    </div>
  );
}
