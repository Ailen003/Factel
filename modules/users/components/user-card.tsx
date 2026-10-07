"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { User } from "../lib/types/user.types";
import {
  getUserRoleInfo,
  getUserAccessState,
  userAccessStateConfig,
} from "../lib/types/user.types";
import { UserActionsMenu } from "./user-actions-menu";
import type { AdminProfileAction } from "../lib/hooks/use-admin-profile-mutation";
import type { UserAdminAction } from "../lib/hooks/use-user-admin-action";
import { CredentialIssuanceBadge } from "./credential-issuance-badge";

export function UserCard({ user, currentUserId, canManageAdmins, canManageTrialUsers, onView, onEdit, onAdminAction, onAdminProfileAction, onCredentialReissue, onCredentialDeliveryConfirm, onMfaRecovery, onOwnershipTransfer }: {
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
}) {
  const tRole = useTranslations("users.roleValues");
  const tAccess = useTranslations("users.accessValues");
  const accessState = getUserAccessState(user);
  const roleKey = user.role === "trial_user"
    ? "trial_user"
    : user.adminProfile ?? "unconfiguredAdmin";
  return (
    <article className="rounded-lg border bg-card shadow-xs">
      <div className="space-y-2 p-4">
        <div><p className="font-medium">{user.fullName}</p><p className="text-xs text-muted-foreground">{user.email}</p></div>
        <div className="flex flex-wrap gap-2">
          <Badge className={cn("border-transparent", getUserRoleInfo(user.role).className)}>{tRole(roleKey)}</Badge>
          <Badge className={cn("border-transparent", userAccessStateConfig[accessState].className)}>{tAccess(accessState)}</Badge>
          {user.latestTemporaryCredentialIssuance && (
            <CredentialIssuanceBadge issuance={user.latestTemporaryCredentialIssuance} />
          )}
        </div>
      </div>
      <div className="flex justify-end gap-1 border-t p-2">
        <UserActionsMenu user={user} currentUserId={currentUserId} canManageAdmins={canManageAdmins} canManageTrialUsers={canManageTrialUsers} onView={onView} onEdit={onEdit} onAdminAction={onAdminAction} onAdminProfileAction={onAdminProfileAction} onCredentialReissue={onCredentialReissue} onCredentialDeliveryConfirm={onCredentialDeliveryConfirm} onMfaRecovery={onMfaRecovery} onOwnershipTransfer={onOwnershipTransfer} />
      </div>
    </article>
  );
}
