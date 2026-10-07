import { useState } from "react";

/**
 * Generic hook for managing item create modal state in list views.
 * Handles opening/closing the create modal.
 * Can be used across any module that needs to create items from a list.
 */
export function useCreateItemListAction() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  /**
   * Opens the create modal
   */
  const handleCreateItem = () => {
    setIsModalOpen(true);
  };

  /**
   * Closes the create modal
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  /**
   * Handles modal open state changes
   * @param open - Whether the modal should be open
   */
  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
  };

  return {
    isModalOpen,
    handleCreateItem,
    handleCloseModal,
    handleModalOpenChange,
  };
}
