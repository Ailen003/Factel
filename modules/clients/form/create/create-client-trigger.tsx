"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal/modal";
import type { ClientCreationResult } from "../../lib/types/client.types";
import ClientDetailsContainer from "../../details/client-details-container";
import CreateClientFormContainer from "./create-client-form-container";

export default function CreateClientTrigger() {
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const lockRef = useRef(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const t = useTranslations("clients");
  const details = useTranslations("clientDetails");
  const router = useRouter();
  const changeLock = useCallback((value: boolean) => { lockRef.current = value; setLocked(value); }, []);
  const changeOpen = useCallback((value: boolean) => { if (!lockRef.current) setOpen(value); }, []);
  const close = useCallback(() => changeOpen(false), [changeOpen]);
  const success = useCallback((result: ClientCreationResult) => {
    toast.success(t("create.success"), { position: "top-right" });
    setOpen(false); setClientId(result.clientId);
    setTimeout(() => router.refresh(), 300);
  }, [router, t]);
  const reuse = useCallback((id: string) => { setOpen(false); setClientId(id); }, []);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />{t("create.trigger")}
      </Button>
      <Modal
        open={open}
        onOpenChange={changeOpen}
        title={t("create.title")}
        description={t("create.description")}
        maxWidth="2xl"
        maxHeight="lg"
        bodyClassName="px-0 py-0 pb-4"
        showCloseButton={!locked}
        closeLabel={t("close")}
        closeOnOverlayClick={!locked}
      >
        
          <CreateClientFormContainer
            onClose={close}
            onSuccess={success}
            onReuse={reuse}
            onLockChange={changeLock}
          />
        
      </Modal>
      <Modal
        open={Boolean(clientId)}
        onOpenChange={(value) => { if (!value) setClientId(null); }}
        title={details("title")}
        description={details("description")}
        closeLabel={t("close")}
        maxWidth="4xl"
        maxHeight="lg"
      >
        {clientId && <ClientDetailsContainer key={clientId} clientId={clientId} />}
      </Modal>
    </>
  );
}
