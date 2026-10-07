"use client";

import { useUser } from "../../lib/hooks/use-user";
import EditUserFormContainer from "./edit-user-form-container";
import { DetailsContainerWrapper } from "@/components/details-container-wrapper/details-container-wrapper";

interface Props {
  userId: string;
  onClose?: () => void;
}

export default function EditUserContainer({ userId, onClose }: Props) {
  const { user, isLoading, error } = useUser({ userId });

  return (
    <DetailsContainerWrapper
      data={user}
      isLoading={isLoading}
      error={error}
      entityKey="user"
      containerClassName="flex flex-col items-center justify-center gap-4 py-32 min-h-[400px]"
    >
      {(user) => <EditUserFormContainer user={user} onClose={onClose} />}
    </DetailsContainerWrapper>
  );
}
