import { useState } from "react";

/**
 * Generic hook for managing item edit modal state in list views.
 * Handles opening/closing the edit modal and tracking the editing item.
 * Can be used across any module that needs to edit items from a list.
 */
export function useEditItemListAction() {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  /**
   * Opens the edit modal for a specific item
   * @param itemId - The ID of the item to edit
   */
  const handleEditItem = (itemId: string) => {
    setEditingItemId(itemId);
    setIsModalOpen(true);
  };

  /**
   * Closes the edit modal and clears the editing item
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setEditingItemId(null);
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
        setEditingItemId(null);
      }, 300);
    }
  };

  return {
    editingItemId,
    isModalOpen,
    handleEditItem,
    handleCloseModal,
    handleModalOpenChange,
  };
}
