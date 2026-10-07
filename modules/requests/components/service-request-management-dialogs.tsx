"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmationDialog, type ConfirmationDialogVariant } from "@/components/confirmation-dialog/confirmation-dialog";
import { Modal } from "@/components/modal/modal";
import ServiceRequestDetailsContainer from "../details/service-request-details-container";
import EditServiceRequestContainer from "../form/edit/edit-service-request-container";
import { useChangeServiceRequestStatus } from "../lib/hooks/use-change-service-request-status";
import { useDeleteServiceRequest } from "../lib/hooks/use-delete-service-request";
import type { ServiceRequest, ServiceRequestStatus } from "../lib/types/service-request.types";
import type { ServiceRequestManagement } from "./use-service-request-management";

const statusVariants: Record<ServiceRequestStatus, ConfirmationDialogVariant> = {
  pending: "default",
  in_progress: "info",
  resolved: "success",
  cancelled: "destructive",
};

function statusActionKey(current: ServiceRequestStatus, target: ServiceRequestStatus) {
  return current === "resolved" || current === "cancelled" ? "reopen" : target;
}

export default function ServiceRequestManagementDialogs({ management, onMutated }: {
  management: ServiceRequestManagement;
  onMutated: () => void;
}) {
  const t = useTranslations("requests");
  const details = useTranslations("requestDetails");
  const edited = useCallback((_request: ServiceRequest) => {
    toast.success(t("edit.success"), { position: "top-right" });
    management.closeEdit();
    onMutated();
  }, [management, onMutated, t]);
  const statusChanged = useCallback((_request: ServiceRequest) => {
    toast.success(t("status.success"), { position: "top-right" });
    management.closeStatus();
    onMutated();
  }, [management, onMutated, t]);
  const deleted = useCallback(() => {
    toast.success(t("delete.success"), { position: "top-right" });
    management.closeDelete();
    onMutated();
  }, [management, onMutated, t]);
  const statusMutation = useChangeServiceRequestStatus(statusChanged);
  const deleteMutation = useDeleteServiceRequest(deleted);
  const statusSelection = management.statusSelection;
  const deletingRequest = management.deletingRequest;

  const changeStatusOpen = useCallback((open: boolean) => {
    if (!open && !statusMutation.isLoading) {
      statusMutation.reset();
      management.closeStatus();
    }
  }, [management, statusMutation]);
  const changeDeleteOpen = useCallback((open: boolean) => {
    if (!open && !deleteMutation.isLoading) {
      deleteMutation.reset();
      management.closeDelete();
    }
  }, [deleteMutation, management]);

  return <>
    <Modal open={Boolean(management.viewingRequestId)} onOpenChange={(open) => { if (!open) management.closeView(); }}
      title={details("title")} description={details("description")} closeLabel={t("close")} maxHeight="lg">
      {management.viewingRequestId && <ServiceRequestDetailsContainer key={management.viewingRequestId}
        requestId={management.viewingRequestId} />}
    </Modal>
    <Modal open={Boolean(management.editingRequestId)} onOpenChange={(open) => { if (!open) management.closeEdit(); }}
      title={details("editTitle")} description={details("editDescription")} closeLabel={t("close")}
      maxWidth="2xl" maxHeight="lg" bodyClassName="px-0 py-0 pb-4">
      {management.editingRequestId && <EditServiceRequestContainer key={management.editingRequestId}
        requestId={management.editingRequestId} onClose={management.closeEdit} onSuccess={edited} />}
    </Modal>
    {statusSelection && <ConfirmationDialog open onOpenChange={changeStatusOpen}
      title={details("statusTitle", { title: statusSelection.request.title })}
      description={details("statusDescription", {
        title: statusSelection.request.title,
        status: t(`statuses.${statusSelection.targetStatus}`),
      })}
      confirmLabel={t(`statusActions.${statusActionKey(statusSelection.request.status, statusSelection.targetStatus)}`)}
      cancelLabel={details("cancel")}
      onConfirm={() => statusMutation.changeStatus(statusSelection.request.id, statusSelection.request.version, statusSelection.targetStatus)}
      isLoading={statusMutation.isLoading} error={statusMutation.error} variant={statusVariants[statusSelection.targetStatus]} />}
    {deletingRequest && <ConfirmationDialog open onOpenChange={changeDeleteOpen}
      title={details("deleteTitle", { title: deletingRequest.title })}
      description={details("deleteDescription", { title: deletingRequest.title })}
      confirmLabel={details("deleteConfirm")} cancelLabel={details("cancel")}
      onConfirm={() => deleteMutation.execute(deletingRequest.id, deletingRequest.version)}
      isLoading={deleteMutation.isLoading} error={deleteMutation.error} variant="destructive" />}
  </>;
}
