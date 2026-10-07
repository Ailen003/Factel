import { useState } from "react";

/**
 * Generic hook for managing item view modal state in list views.
 * Handles opening/closing the view modal and tracking the viewing item.
 * Can be used across any module that needs to view items from a list.
 */
export function useViewItemListAction() {
  const [viewingItemId, setViewingItemId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  /**
   * Opens the view modal for a specific item
   * @param itemId - The ID of the item to view
   */
  const handleViewItem = (itemId: string) => {
    setViewingItemId(itemId);
    setIsModalOpen(true);
  };

  /**
   * Closes the view modal and clears the viewing item
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setViewingItemId(null);
    }, 300);
  };

  /**
   * Handles modal open state changes
   * @param open - Whether the modal should be open
   */
  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setTimeout(() => {
        setViewingItemId(null);
      }, 300);
    }
  };

  return {
    viewingItemId,
    isModalOpen,
    handleViewItem,
    handleCloseModal,
    handleModalOpenChange,
  };
}
