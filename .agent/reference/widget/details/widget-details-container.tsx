"use client";

import { useWidget } from "../lib/hooks/use-widget";
import WidgetDetailsPresentational from "./widget-details-presentational";
import WidgetDetailsState from "../components/widget-details-state";

interface Props {
  widgetId: string;
}

export default function WidgetDetailsContainer({ widgetId }: Props) {
  const { widget, isLoading, error } = useWidget({ widgetId });
  return (
    <WidgetDetailsState data={widget} isLoading={isLoading} error={error}>
      {(widget) => <WidgetDetailsPresentational widget={widget} />}
    </WidgetDetailsState>
  );
}
