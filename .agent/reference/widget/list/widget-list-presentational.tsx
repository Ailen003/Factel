"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/modal/modal";
import ToggleWidgetActiveContainer from "../activate/toggle-widget-active-container";
import DeleteWidgetContainer from "../delete/delete-widget-container";
import WidgetDetailsContainer from "../details/widget-details-container";
import EditWidgetContainer from "../form/edit/edit-widget-container";
import type { Widget } from "../lib/types/widget.types";
import {
  useBulkDeleteWidgetListAction,
  useDeleteWidgetListAction,
  useEditWidgetListAction,
  useViewWidgetListAction,
} from "./hooks";
import WidgetListCardsView from "./widget-list-cards-view";
import WidgetListTableView from "./widget-list-table-view";

interface Props {
  widgets: Widget[];
}

export default function WidgetListPresentational({ widgets }: Props) {
  const t = useTranslations("widgetDetails");
  const {
    editingItemId,
    isModalOpen: isEditModalOpen,
    handleEditItem,
    handleCloseModal,
    handleModalOpenChange: handleEditModalOpenChange,
  } = useEditWidgetListAction();
  const { viewingItemId, isModalOpen, handleViewItem, handleModalOpenChange } =
    useViewWidgetListAction();
  const {
    deletingItemId,
    isDeleteDialogOpen,
    handleDeleteItem,
    handleDeleteDialogOpenChange,
  } = useDeleteWidgetListAction();
  const { isDeletingWidgets, handleBulkDelete } = useBulkDeleteWidgetListAction();
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);
  const [isToggleDialogOpen, setIsToggleDialogOpen] = useState(false);

  const handleToggleActive = (id: string) => {
    setTogglingActiveId(id);
    setIsToggleDialogOpen(true);
  };

  const handleToggleDialogOpenChange = (open: boolean) => {
    setIsToggleDialogOpen(open);
    if (!open) setTogglingActiveId(null);
  };

  return (
    <div className="pb-4">
      <div className="hidden md:block">
        <WidgetListTableView
          widgets={widgets}
          onViewWidget={handleViewItem}
          onEditWidget={handleEditItem}
          onToggleActive={handleToggleActive}
          onDeleteWidget={handleDeleteItem}
          onBulkDelete={handleBulkDelete}
          isDeletingWidgets={isDeletingWidgets}
        />
      </div>

      <div className="block md:hidden">
        <WidgetListCardsView
          widgets={widgets}
          onViewWidget={handleViewItem}
          onEditWidget={handleEditItem}
          onToggleActive={handleToggleActive}
          onDeleteWidget={handleDeleteItem}
        />
      </div>

      <Modal
        open={isEditModalOpen}
        onOpenChange={handleEditModalOpenChange}
        title={t("editWidget")}
        description={t("editWidgetDescription")}
        maxWidth="2xl"
        bodyClassName="px-0 py-0 pb-4"
      >
        {editingItemId && <EditWidgetContainer widgetId={editingItemId} onClose={handleCloseModal} />}
      </Modal>

      <Modal
        open={isModalOpen}
        onOpenChange={handleModalOpenChange}
        title={t("title")}
        description={t("detailsDescription")}
        maxWidth="xl"
        maxHeight="lg"
      >
        {viewingItemId && <WidgetDetailsContainer widgetId={viewingItemId} />}
      </Modal>

      {deletingItemId && (
        <DeleteWidgetContainer
          widgetId={deletingItemId}
          open={isDeleteDialogOpen}
          onOpenChange={handleDeleteDialogOpenChange}
        />
      )}

      {togglingActiveId && (
        <ToggleWidgetActiveContainer
          widgetId={togglingActiveId}
          isActive={widgets.find((widget) => widget.id === togglingActiveId)?.isActive ?? true}
          open={isToggleDialogOpen}
          onOpenChange={handleToggleDialogOpenChange}
        />
      )}
    </div>
  );
}
