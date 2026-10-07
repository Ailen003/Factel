"use client";

import { TableProperties } from "lucide-react";
import { useTranslations } from "next-intl";
import { CardViewWrapper, type HeaderConfig } from "@/components/ui/card-view-wrapper";
import { UserCard } from "../components/user-card";
import type { User } from "../lib/types/user.types";
import type { AdminProfileAction } from "../lib/hooks/use-admin-profile-mutation";
import type { UserAdminAction } from "../lib/hooks/use-user-admin-action";

export default function UsersListCardsView({ users, currentUserId, canManageAdmins, canManageTrialUsers, onViewUser, onEditUser, onAdminAction, onAdminProfileAction, onCredentialReissue, onCredentialDeliveryConfirm, onMfaRecovery, onOwnershipTransfer }: {
  users: User[];
  currentUserId: string;
  canManageAdmins: boolean;
  canManageTrialUsers: boolean;
  onViewUser: (id: string) => void;
  onEditUser: (id: string) => void;
  onAdminAction: (user: User, action: UserAdminAction) => void;
  onAdminProfileAction: (user: User, action: AdminProfileAction) => void;
  onCredentialReissue: (user: User) => void;
  onCredentialDeliveryConfirm: (user: User) => void;
  onMfaRecovery: (user: User) => void;
  onOwnershipTransfer: (user: User) => void;
}) {
  const t = useTranslations("table");
  const headerConfig: HeaderConfig = { title: t("users"), icon: <TableProperties className="h-6 w-6" /> };
  return <CardViewWrapper headerConfig={headerConfig}><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{users.map((user) => <UserCard key={user.id} user={user} currentUserId={currentUserId} canManageAdmins={canManageAdmins} canManageTrialUsers={canManageTrialUsers} onView={onViewUser} onEdit={onEditUser} onAdminAction={onAdminAction} onAdminProfileAction={onAdminProfileAction} onCredentialReissue={onCredentialReissue} onCredentialDeliveryConfirm={onCredentialDeliveryConfirm} onMfaRecovery={onMfaRecovery} onOwnershipTransfer={onOwnershipTransfer} />)}</div></CardViewWrapper>;
}
