import { getAllClientsAction } from "../lib/actions/client.actions";
import type { ClientFiltersDto } from "../lib/types/client.types";
import ModulePagination from "@/components/pagination/module-pagination";
import ClientsListPresentational from "./clients-list-presentational";

export default async function ClientsListContainer({ filters }: { filters: ClientFiltersDto }) {
  const response = await getAllClientsAction(filters);
  return <div>
    <ClientsListPresentational response={response} />
    {response.success && <ModulePagination pagination={response.data.pagination} limitOptions={[5, 10, 20, 30]} />}
  </div>;
}
