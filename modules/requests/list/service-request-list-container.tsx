import { getAllServiceRequestsAction } from "../lib/actions/service-request.actions";
import type { ServiceRequestFiltersDto } from "../lib/types/service-request.types";
import ModulePagination from "@/components/pagination/module-pagination";
import ServiceRequestListPresentational from "./service-request-list-presentational";

export default async function ServiceRequestListContainer({ filters }: { filters: ServiceRequestFiltersDto }) {
  const response = await getAllServiceRequestsAction(filters);
  return <div><ServiceRequestListPresentational response={response} />
    {response.success && <ModulePagination pagination={response.data.pagination} limitOptions={[5, 10, 20, 30]} />}</div>;
}
