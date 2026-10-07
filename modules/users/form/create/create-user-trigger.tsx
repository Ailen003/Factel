"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal/modal";
import CreateUserFormContainer from "./create-user-form-container";

export default function CreateUserTrigger() {
  const [open, setOpen] = useState(false);
  const [credentialVisible, setCredentialVisible] = useState(false);
  const t = useTranslations("users.create");
  function setModalOpen(nextOpen: boolean) {
    if (!nextOpen && credentialVisible) return;
    setOpen(nextOpen);
    if (nextOpen) setCredentialVisible(false);
  }
  function closeModal() {
    setCredentialVisible(false);
    setOpen(false);
  }
  return (
    <>
      <Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" />{t("trigger")}</Button>
      <Modal
        open={open}
        onOpenChange={setModalOpen}
        title={t("modalTitle")}
        description={t("modalDescription")}
        maxWidth="md"
        maxHeight="lg"
        bodyClassName="py-0"
        showCloseButton={!credentialVisible}
        closeOnOverlayClick={!credentialVisible}
      >
        {open && (
          <CreateUserFormContainer
            onClose={closeModal}
            onCredentialVisibleChange={setCredentialVisible}
          />
        )}
      </Modal>
    </>
  );
}
