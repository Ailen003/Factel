"use client";

import { DetailsContainerWrapper } from "@/components/details-container-wrapper/details-container-wrapper";
import { useClient } from "../../lib/hooks/use-client";
import EditClientFormContainer from "./edit-client-form-container";

export default function EditClientContainer({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const { client, isLoading, error } = useClient({ clientId });
  return <DetailsContainerWrapper data={client} isLoading={isLoading} error={error} entityKey="client"
    containerClassName="flex min-h-[400px] flex-col items-center justify-center gap-4 py-32">
    {(data) => <EditClientFormContainer client={data} onClose={onClose} />}
  </DetailsContainerWrapper>;
}
