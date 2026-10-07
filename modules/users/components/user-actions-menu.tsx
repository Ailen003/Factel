"use client";

import {
  Edit,
  Eye,
  Crown,
  KeyRound,
  Send,
  LogOut,
  MoreHorizontal,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  RotateCcwKey,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "../lib/types/user.types";
import type { AdminProfileAction } from "../lib/hooks/use-admin-profile-mutation";
import type { UserAdminAction } from "../lib/hooks/use-user-admin-action";

interface Props {
  user: User;
  currentUserId: string;
  canManageAdmins: boolean;
  canManageTrialUsers: boolean;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onAdminAction: (user: User, action: UserAdminAction) => void;
  onAdminProfileAction: (user: User, action: AdminProfileAction) => void;
  onCredentialReissue: (user: User) => void;
  onCredentialDeliveryConfirm: (user: User) => void;
  onMfaRecovery: (user: User) => void;
  onOwnershipTransfer: (user: User) => void;
}

export function UserActionsMenu({
  user,
  currentUserId,
  canManageAdmins,
  canManageTrialUsers,
  onView,
  onEdit,
  onAdminAction,
  onAdminProfileAction,
  onCredentialReissue,
  onCredentialDeliveryConfirm,
  onMfaRecovery,
  onOwnershipTransfer,
}: Props) {
  const t = useTranslations("users.actions");
  const isTrialUser = user.role === "trial_user";
  const canEdit = isTrialUser ? canManageTrialUsers : canManageAdmins;
  const canManageTrial = isTrialUser && canManageTrialUsers;
  const canPromote = canManageAdmins && canManageTrial && user.status === "active";
  const canDemote = canManageAdmins && user.adminProfile === "operator";
  const isOtherMfaReadyOperator =
    user.id !== currentUserId &&
    user.role === "platform_admin" &&
    user.adminProfile === "operator" &&
    user.twoFactorEnabled &&
    user.twoFactorVerified;
  const canRecoverMfa = canManageAdmins && isOtherMfaReadyOperator;
  const canTransferOwnership = canRecoverMfa && user.status === "active";
  const canConfirmCredentialDelivery =
    canManageTrial &&
    user.latestTemporaryCredentialIssuance?.status === "issued" &&
    user.latestTemporaryCredentialIssuance.deliveredAt === null &&
    user.latestTemporaryCredentialIssuance.version === user.temporaryCredentialVersion;
  const credentialAction = user.trialActivatedAt === null
    ? "reissueActivationCredential"
    : "resetAccess";
  const blockedProfileReason = canManageAdmins && isTrialUser && user.status !== "active"
    ? t("promotionRequiresActive")
    : canManageAdmins && user.adminProfile === "owner"
      ? t("ownerProtected")
      : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("menuLabel")}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-64">
        <DropdownMenuItem onSelect={() => onView(user.id)}>
          <Eye />{t("view")}
        </DropdownMenuItem>
        {canEdit && (
          <DropdownMenuItem onSelect={() => onEdit(user.id)}>
            <Edit />{t("edit")}
          </DropdownMenuItem>
        )}
        {!isTrialUser && !canManageAdmins && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{t("adminOwnerOnly")}</p>
        )}
        {blockedProfileReason && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            {blockedProfileReason}
          </p>
        )}
        {(canManageTrial || canDemote || canRecoverMfa) && <DropdownMenuSeparator />}
        {canRecoverMfa && (
          <DropdownMenuItem onSelect={() => onMfaRecovery(user)}>
            <RotateCcwKey />{t("recoverOperatorMfa")}
          </DropdownMenuItem>
        )}
        {canTransferOwnership && (
          <DropdownMenuItem onSelect={() => onOwnershipTransfer(user)}>
            <Crown />{t("transferOwnership")}
          </DropdownMenuItem>
        )}
        {canPromote && (
          <DropdownMenuItem onSelect={() => onAdminProfileAction(user, "promoteOperator")}>
            <UserPlus />{t("promoteOperator")}
          </DropdownMenuItem>
        )}
        {canDemote && (
          <DropdownMenuItem onSelect={() => onAdminProfileAction(user, "demoteOperator")}>
            <UserMinus />{t("demoteOperator")}
          </DropdownMenuItem>
        )}
        {canManageTrial && (
          <DropdownMenuItem onSelect={() => onCredentialReissue(user)}>
            <KeyRound />{t(credentialAction)}
          </DropdownMenuItem>
        )}
        {canConfirmCredentialDelivery && (
          <DropdownMenuItem onSelect={() => onCredentialDeliveryConfirm(user)}>
            <Send />{t("confirmCredentialDelivery")}
          </DropdownMenuItem>
        )}
        {canManageTrial && (
          <DropdownMenuItem
            onSelect={() => onAdminAction(
              user,
              user.status === "active" ? "suspend" : "activate",
            )}
          >
            {user.status === "active" ? <UserX /> : <UserCheck />}
            {t(user.status === "active" ? "suspend" : "activate")}
          </DropdownMenuItem>
        )}
        {canManageTrial && (
          <DropdownMenuItem onSelect={() => onAdminAction(user, "revokeSessions")}>
            <LogOut />{t("revokeSessions")}
          </DropdownMenuItem>
        )}
        {canManageTrial && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onAdminAction(user, "delete")}
            >
              <Trash2 />{t("delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
