"use client";

import { useWidget } from "../../lib/hooks/use-widget";
import EditWidgetFormContainer from "./edit-widget-form-container";
import WidgetDetailsState from "../../components/widget-details-state";

interface Props {
  widgetId: string;
  onClose?: () => void;
}

export default function EditWidgetContainer({ widgetId, onClose }: Props) {
  const { widget, isLoading, error } = useWidget({ widgetId });

  return (
    <WidgetDetailsState data={widget} isLoading={isLoading} error={error}>
      {(widget) => <EditWidgetFormContainer widget={widget} onClose={onClose} />}
    </WidgetDetailsState>
  );
}
