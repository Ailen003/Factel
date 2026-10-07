// Re-export generic hooks with widget-specific aliases for better semantics
export { useEditItemListAction as useEditWidgetListAction } from "@/modules/hooks/use-edit-item-list-action";
export { useViewItemListAction as useViewWidgetListAction } from "@/modules/hooks/use-view-item-list-action";
export { useDeleteItemListAction as useDeleteWidgetListAction } from "@/modules/hooks/use-delete-item-list-action";
export { useBulkDeleteWidgetListAction } from "./use-bulk-delete-widget-list-action";
