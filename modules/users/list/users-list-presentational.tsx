"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Modal } from "@/components/modal/modal";
import { ConfirmationDialog } from "@/components/confirmation-dialog/confirmation-dialog";
import { useEditUserListAction, useViewUserListAction } from "./hooks";
import type { User } from "../lib/types/user.types";
import UsersListTableView from "./users-list-table-view";
import UsersListCardsView from "./users-list-cards-view";
import EditUserContainer from "../form/edit/edit-user-container";
import UserDetailsContainer from "../details/user-details-container";
import { CredentialReissueContainer } from "../credential-reissue/credential-reissue-container";
import { CredentialDeliveryConfirmation } from "../credential-reissue/credential-delivery-confirmation";
import { OperatorMfaRecoveryContainer } from "../mfa-recovery/operator-mfa-recovery-container";
import { OwnershipTransferInitiateContainer } from "../ownership-transfer/ownership-transfer-initiate-container";
import { OwnershipTransferPanelContainer } from "../ownership-transfer/ownership-transfer-panel-container";
import {
  useAdminProfileMutation,
  type AdminProfileAction,
} from "../lib/hooks/use-admin-profile-mutation";
import {
  useUserAdminAction,
  type UserAdminAction,
} from "../lib/hooks/use-user-admin-action";

interface Props {
  users: User[];
  currentUserId: string;
  canManageAdmins: boolean;
  canManageTrialUsers: boolean;
}

export default function UsersListPresentational({ users, currentUserId, canManageAdmins, canManageTrialUsers }: Props) {
  const router = useRouter();
  const t = useTranslations("userDetails");
  const tConfirm = useTranslations("users.confirmations");
  const tSuccess = useTranslations("users.success");
  const edit = useEditUserListAction();
  const view = useViewUserListAction();
  const [pending, setPending] = useState<{
    user: User;
    action: UserAdminAction;
  } | null>(null);
  const [profilePending, setProfilePending] = useState<{
    user: User;
    action: AdminProfileAction;
    operationId: string;
  } | null>(null);
  const [credentialSelection, setCredentialSelection] = useState<{
    user: User;
    operationId: string;
  } | null>(null);
  const [credentialBusy, setCredentialBusy] = useState(false);
  const [deliverySelection, setDeliverySelection] = useState<User | null>(null);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [securitySelection, setSecuritySelection] = useState<{
    kind: "recoverMfa" | "initiateTransfer";
    user: User;
    operationId: string;
  } | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [transferRefreshKey, setTransferRefreshKey] = useState(0);
  const refresh = useCallback(() => {
    setTimeout(() => router.refresh(), 300);
  }, [router]);
  const handleSuccess = useCallback((action: UserAdminAction, revokedSessions: number) => {
    toast.success(tSuccess(action, { count: revokedSessions }), { position: "top-right" });
    setPending(null);
    refresh();
  }, [refresh, tSuccess]);
  const handleProfileSuccess = useCallback((action: AdminProfileAction, result: { revokedSessions: number }) => {
    toast.success(tSuccess(action, { count: result.revokedSessions }), { position: "top-right" });
    setProfilePending(null);
    refresh();
  }, [refresh, tSuccess]);
  const adminAction = useUserAdminAction(handleSuccess);
  const profileAction = useAdminProfileMutation(handleProfileSuccess);
  const handleAdminAction = useCallback((user: User, action: UserAdminAction) => {
    adminAction.reset();
    setPending({ user, action });
  }, [adminAction]);
  const handleAdminProfileAction = useCallback((user: User, action: AdminProfileAction) => {
    profileAction.reset();
    setProfilePending({ user, action, operationId: crypto.randomUUID() });
  }, [profileAction]);
  const handleConfirmationOpenChange = useCallback((open: boolean) => {
    if (!open && !adminAction.isLoading) {
      adminAction.reset();
      setPending(null);
    }
  }, [adminAction]);
  const handleProfileConfirmationOpenChange = useCallback((open: boolean) => {
    if (!open && !profileAction.isLoading) {
      profileAction.reset();
      setProfilePending(null);
    }
  }, [profileAction]);
  const handleCredentialReissue = useCallback((user: User) => {
    if (!canManageTrialUsers || user.role !== "trial_user") return;
    view.handleModalOpenChange(false);
    setCredentialBusy(false);
    setCredentialSelection({ user, operationId: crypto.randomUUID() });
  }, [canManageTrialUsers, view]);
  const closeCredentialReissue = useCallback(() => {
    if (credentialBusy) return;
    setCredentialSelection(null);
    setCredentialBusy(false);
    refresh();
  }, [credentialBusy, refresh]);
  const handleCredentialModalOpenChange = useCallback((open: boolean) => {
    if (!open) closeCredentialReissue();
  }, [closeCredentialReissue]);
  const handleCredentialDeliveryConfirm = useCallback((user: User) => {
    const issuance = user.latestTemporaryCredentialIssuance;
    if (
      !canManageTrialUsers ||
      user.role !== "trial_user" ||
      issuance?.status !== "issued" ||
      issuance.deliveredAt !== null ||
      issuance.version !== user.temporaryCredentialVersion
    ) return;
    view.handleModalOpenChange(false);
    setDeliveryBusy(false);
    setDeliverySelection(user);
  }, [canManageTrialUsers, view]);
  const closeCredentialDelivery = useCallback(() => {
    if (deliveryBusy) return;
    setDeliverySelection(null);
    setDeliveryBusy(false);
    refresh();
  }, [deliveryBusy, refresh]);
  const openSecurityFlow = useCallback((kind: "recoverMfa" | "initiateTransfer", user: User) => {
    view.handleModalOpenChange(false);
    setSecurityBusy(false);
    setSecuritySelection({ kind, user, operationId: crypto.randomUUID() });
  }, [view]);
  const closeSecurityFlow = useCallback(() => {
    if (securityBusy) return;
    setSecuritySelection(null);
    setSecurityBusy(false);
    refresh();
  }, [refresh, securityBusy]);
  const handleSecurityCompleted = useCallback(() => {
    setTransferRefreshKey((key) => key + 1);
  }, []);

  const confirmation = pending ? {
    title: tConfirm(`${pending.action}Title`, { name: pending.user.fullName }),
    description: tConfirm(`${pending.action}Description`, { name: pending.user.fullName }),
    confirmLabel: tConfirm(`${pending.action}Confirm`),
  } : null;
  const profileConfirmation = profilePending ? {
    title: tConfirm(`${profilePending.action}Title`, { name: profilePending.user.fullName }),
    description: tConfirm(`${profilePending.action}Description`, { name: profilePending.user.fullName }),
    confirmLabel: tConfirm(`${profilePending.action}Confirm`),
  } : null;
  const viewProps = {
    users,
    currentUserId,
    canManageAdmins,
    canManageTrialUsers,
    onViewUser: view.handleViewItem,
    onEditUser: edit.handleEditItem,
    onAdminAction: handleAdminAction,
    onAdminProfileAction: handleAdminProfileAction,
    onCredentialReissue: handleCredentialReissue,
    onCredentialDeliveryConfirm: handleCredentialDeliveryConfirm,
    onMfaRecovery: (user: User) => openSecurityFlow("recoverMfa", user),
    onOwnershipTransfer: (user: User) => openSecurityFlow("initiateTransfer", user),
  };
  return (
    <div className="pb-4">
      <div className="mb-4">
        <OwnershipTransferPanelContainer refreshKey={transferRefreshKey} />
      </div>
      <div className="hidden md:block"><UsersListTableView {...viewProps} /></div>
      <div className="block md:hidden"><UsersListCardsView {...viewProps} /></div>
      <Modal open={edit.isModalOpen} onOpenChange={edit.handleModalOpenChange} title={t("editUser")} description={t("editUserDescription")} maxWidth="2xl" bodyClassName="px-0 py-0 pb-4">
        {edit.editingItemId && <EditUserContainer userId={edit.editingItemId} onClose={edit.handleCloseModal} />}
      </Modal>
      <Modal open={view.isModalOpen} onOpenChange={view.handleModalOpenChange} title={t("title")} description={t("description")} maxWidth="lg" maxHeight="lg">
        {view.viewingItemId && <UserDetailsContainer userId={view.viewingItemId} canManageAdmins={canManageAdmins} canManageTrialUsers={canManageTrialUsers} onCredentialReissue={handleCredentialReissue} onCredentialDeliveryConfirm={handleCredentialDeliveryConfirm} />}
      </Modal>
      <Modal
        open={Boolean(securitySelection)}
        onOpenChange={(open) => { if (!open) closeSecurityFlow(); }}
        title={securitySelection
          ? tConfirm(`${securitySelection.kind}Title`, { name: securitySelection.user.fullName })
          : undefined}
        description={securitySelection ? tConfirm(`${securitySelection.kind}Description`) : undefined}
        closeLabel={tConfirm("closeSecurityModal")}
        maxWidth="lg"
        maxHeight="xl"
        bodyClassName="px-0 py-0"
        showCloseButton={!securityBusy}
        closeOnOverlayClick={!securityBusy}
      >
        {securitySelection?.kind === "recoverMfa" && (
          <OperatorMfaRecoveryContainer
            key={`${securitySelection.user.id}:${securitySelection.operationId}`}
            user={securitySelection.user}
            operationId={securitySelection.operationId}
            onClose={closeSecurityFlow}
            onBusyChange={setSecurityBusy}
            onCompleted={handleSecurityCompleted}
          />
        )}
        {securitySelection?.kind === "initiateTransfer" && (
          <OwnershipTransferInitiateContainer
            key={`${securitySelection.user.id}:${securitySelection.operationId}`}
            currentUserId={currentUserId}
            target={securitySelection.user}
            operationId={securitySelection.operationId}
            onClose={closeSecurityFlow}
            onBusyChange={setSecurityBusy}
            onCompleted={handleSecurityCompleted}
          />
        )}
      </Modal>
      <Modal
        open={Boolean(deliverySelection)}
        onOpenChange={(open) => { if (!open) closeCredentialDelivery(); }}
        title={deliverySelection
          ? tConfirm("credentialDeliveryTitle", { name: deliverySelection.fullName })
          : undefined}
        description={deliverySelection ? tConfirm("credentialDeliveryDescription") : undefined}
        closeLabel={tConfirm("closeCredentialDeliveryModal")}
        maxWidth="lg"
        bodyClassName="px-0 py-0"
        showCloseButton={!deliveryBusy}
        closeOnOverlayClick={!deliveryBusy}
      >
        {deliverySelection && (
          <CredentialDeliveryConfirmation
            user={deliverySelection}
            onClose={closeCredentialDelivery}
            onBusyChange={setDeliveryBusy}
          />
        )}
      </Modal>
      <Modal
        open={Boolean(credentialSelection)}
        onOpenChange={handleCredentialModalOpenChange}
        title={credentialSelection
          ? tConfirm(credentialSelection.user.trialActivatedAt === null
            ? "credentialActivationTitle"
            : "credentialRecoveryTitle", { name: credentialSelection.user.fullName })
          : undefined}
        description={credentialSelection
          ? tConfirm(credentialSelection.user.trialActivatedAt === null
            ? "credentialActivationDescription"
            : "credentialRecoveryDescription")
          : undefined}
        closeLabel={tConfirm("closeCredentialModal")}
        maxWidth="lg"
        maxHeight="xl"
        bodyClassName="px-0 py-0"
        showCloseButton={!credentialBusy}
        closeOnOverlayClick={!credentialBusy}
      >
        {credentialSelection && (
          <CredentialReissueContainer
            key={`${credentialSelection.user.id}:${credentialSelection.operationId}`}
            user={credentialSelection.user}
            operationId={credentialSelection.operationId}
            onClose={closeCredentialReissue}
            onBusyChange={setCredentialBusy}
          />
        )}
      </Modal>
      {pending && confirmation && (
        <ConfirmationDialog
          open
          onOpenChange={handleConfirmationOpenChange}
          title={confirmation.title}
          description={confirmation.description}
          confirmLabel={confirmation.confirmLabel}
          cancelLabel={tConfirm("cancel")}
          onConfirm={() => adminAction.execute(pending.action, pending.user.id)}
          isLoading={adminAction.isLoading}
          error={adminAction.error}
          variant={pending.action === "delete" ? "destructive" : pending.action === "activate" ? "success" : "warning"}
        />
      )}
      {profilePending && profileConfirmation && (
        <ConfirmationDialog
          open
          onOpenChange={handleProfileConfirmationOpenChange}
          title={profileConfirmation.title}
          description={profileConfirmation.description}
          confirmLabel={profileConfirmation.confirmLabel}
          cancelLabel={tConfirm("cancel")}
          onConfirm={() => profileAction.execute(
            profilePending.action,
            profilePending.user,
            profilePending.operationId,
          )}
          isLoading={profileAction.isLoading}
          error={profileAction.error}
          variant={profilePending.action === "promoteOperator" ? "success" : "warning"}
        />
      )}
    </div>
  );
}
