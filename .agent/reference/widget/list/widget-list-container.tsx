import { getAllWidgetsAction } from "../lib/actions/widget.actions";
import { WidgetFiltersDto } from "../lib/types/widget.types";
import ModulePagination from "@/components/pagination/module-pagination";
import WidgetListPresentational from "./widget-list-presentational";

interface Props {
  filters: WidgetFiltersDto;
}

export default async function WidgetListContainer({ filters }: Props) {
  const widgetsResponse = await getAllWidgetsAction(filters);
  return (
    <div>
      <WidgetListPresentational widgets={widgetsResponse.widgets} />
      <ModulePagination
        pagination={widgetsResponse.pagination}
        limitOptions={[5, 10, 20, 30]}
      />
    </div>
  );
}
