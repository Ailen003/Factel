import { useState } from "react";

/**
 * Generic hook for managing item delete dialog state in list views.
 * Handles opening/closing the delete confirmation dialog and tracking the deleting item.
 * Can be used across any module that needs to delete items from a list.
 */
export function useDeleteItemListAction() {
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  /**
   * Opens the delete confirmation dialog for a specific item
   * @param itemId - The ID of the item to delete
   */
  const handleDeleteItem = (itemId: string) => {
    setDeletingItemId(itemId);
    setIsDeleteDialogOpen(true);
  };

  /**
   * Handles delete dialog open state changes
   * @param open - Whether the dialog should be open
   */
  const handleDeleteDialogOpenChange = (open: boolean) => {
    setIsDeleteDialogOpen(open);
    if (!open) {
      setDeletingItemId(null);
    }
  };

  /**
   * Closes the delete dialog and clears the deleting item
   */
  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingItemId(null);
  };

  return {
    deletingItemId,
    isDeleteDialogOpen,
    handleDeleteItem,
    handleDeleteDialogOpenChange,
    handleCloseDeleteDialog,
  };
}
