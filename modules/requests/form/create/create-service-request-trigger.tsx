"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal/modal";
import type { ServiceRequestCreationResult } from "../../lib/types/service-request.types";
import ServiceRequestDetailsContainer from "../../details/service-request-details-container";
import CreateServiceRequestFormContainer from "./create-service-request-form-container";

export default function CreateServiceRequestTrigger() {
  const [open, setOpen] = useState(false); const [locked, setLocked] = useState(false); const lockRef = useRef(false);
  const [requestId, setRequestId] = useState<string | null>(null); const t = useTranslations("requests");
  const details = useTranslations("requestDetails"); const router = useRouter();
  const changeLock = useCallback((value: boolean) => { lockRef.current = value; setLocked(value); }, []);
  const changeOpen = useCallback((value: boolean) => { if (!lockRef.current) setOpen(value); }, []);
  const success = useCallback((result: ServiceRequestCreationResult) => { toast.success(t("create.success"), { position: "top-right" });
    setOpen(false); setRequestId(result.requestId); setTimeout(() => router.refresh(), 300); }, [router, t]);
  return <>
    <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{t("create.trigger")}</Button>
    <Modal open={open} onOpenChange={changeOpen} title={t("create.title")} description={t("create.description")}
      maxWidth="2xl" maxHeight="lg" bodyClassName="px-0 py-0 pb-4" showCloseButton={!locked}
      closeLabel={t("close")} closeOnOverlayClick={!locked}>
      <CreateServiceRequestFormContainer onClose={() => changeOpen(false)} onSuccess={success} onLockChange={changeLock} />
    </Modal>
    <Modal open={Boolean(requestId)} onOpenChange={(value) => { if (!value) setRequestId(null); }}
      title={details("title")} description={details("description")} closeLabel={t("close")} maxHeight="lg">
      {requestId && <ServiceRequestDetailsContainer key={requestId} requestId={requestId} />}
    </Modal>
  </>;
}
