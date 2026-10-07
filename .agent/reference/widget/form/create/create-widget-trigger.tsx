"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Modal } from "@/components/modal/modal";
import CreateWidgetFormContainer from "./create-widget-form-container";
import { useTranslations } from "next-intl";

export default function CreateWidgetTrigger() {
  const t = useTranslations("widgets");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="h-4 w-4 mr-1" />
        {t("create")}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t("createTitle")}
        description={t("createDescription")}
        maxWidth="2xl"
        bodyClassName="px-0 py-0 pb-4"
      >
        <CreateWidgetFormContainer onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}
