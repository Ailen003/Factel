import { getAllUsersAction } from "../lib/actions/user.actions";
import { UserFiltersDto } from "../lib/types/user.types";
import UsersListPresentational from "./users-list-presentational";
import ModulePagination from "@/components/pagination/module-pagination";

interface Props {
  filters: UserFiltersDto;
  currentUserId: string;
  canManageAdmins: boolean;
  canManageTrialUsers: boolean;
}

export default async function UsersListContainer({ filters, currentUserId, canManageAdmins, canManageTrialUsers }: Props) {
  const response = await getAllUsersAction(filters);
  if (!response.success) throw new Error(response.error.code);
  const usersResponse = response.data;

  return (
    <div>
      <UsersListPresentational
        users={usersResponse.users}
        currentUserId={currentUserId}
        canManageAdmins={canManageAdmins}
        canManageTrialUsers={canManageTrialUsers}
      />
      <ModulePagination
        pagination={usersResponse.pagination}
        limitOptions={[5, 10, 20, 30]}
      />
    </div>
  );
}
