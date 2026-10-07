"use client";

import { TableProperties } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/dates";
import type { User } from "../lib/types/user.types";
import { getUserAccessState, getUserRoleInfo, userAccessStateConfig } from "../lib/types/user.types";
import { UserActionsMenu } from "../components/user-actions-menu";
import { CredentialIssuanceBadge } from "../components/credential-issuance-badge";
import type { AdminProfileAction } from "../lib/hooks/use-admin-profile-mutation";
import type { UserAdminAction } from "../lib/hooks/use-user-admin-action";

export default function UsersListTableView({ users, currentUserId, canManageAdmins, canManageTrialUsers, onViewUser, onEditUser, onAdminAction, onAdminProfileAction, onCredentialReissue, onCredentialDeliveryConfirm, onMfaRecovery, onOwnershipTransfer }: {
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
  const tRole = useTranslations("users.roleValues");
  const tAccess = useTranslations("users.accessValues");
  const columns: ColumnDef<User>[] = [
    { accessorKey: "fullName", header: t("name"), cell: ({ row }) => <div><p className="font-medium">{row.original.fullName}</p><p className="text-xs text-muted-foreground">{row.original.email}</p></div> },
    { accessorKey: "role", header: t("role"), cell: ({ row }) => { const user = row.original; const roleKey = user.role === "trial_user" ? "trial_user" : user.adminProfile ?? "unconfiguredAdmin"; return <Badge className={cn("border-transparent", getUserRoleInfo(user.role).className)}>{tRole(roleKey)}</Badge>; } },
    { accessorKey: "status", header: t("status"), cell: ({ row }) => { const accessState = getUserAccessState(row.original); return <div className="flex flex-wrap gap-1"><Badge className={cn("border-transparent", userAccessStateConfig[accessState].className)}>{tAccess(accessState)}</Badge>{row.original.latestTemporaryCredentialIssuance && <CredentialIssuanceBadge issuance={row.original.latestTemporaryCredentialIssuance} />}</div>; } },
    { accessorKey: "createdAt", header: t("created"), cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDateTime(row.original.createdAt)}</span> },
    { id: "actions", header: t("actions"), cell: ({ row }) => <UserActionsMenu user={row.original} currentUserId={currentUserId} canManageAdmins={canManageAdmins} canManageTrialUsers={canManageTrialUsers} onView={onViewUser} onEdit={onEditUser} onAdminAction={onAdminAction} onAdminProfileAction={onAdminProfileAction} onCredentialReissue={onCredentialReissue} onCredentialDeliveryConfirm={onCredentialDeliveryConfirm} onMfaRecovery={onMfaRecovery} onOwnershipTransfer={onOwnershipTransfer} /> },
  ];
  return <DataTable tableId="users-list" columns={columns} data={users} dataEmptyText={t("noUsersFound")} headerConfig={{ title: t("users"), icon: <TableProperties className="h-6 w-6" /> }} showPagination={false} />;
}
