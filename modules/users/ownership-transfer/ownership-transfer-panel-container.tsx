"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/modal/modal";
import { useAdminSecurity } from "../lib/hooks/use-admin-security";
import { OwnershipTransferPanelPresentational } from "./ownership-transfer-panel-presentational";
import { OwnershipTransferResolutionContainer } from "./ownership-transfer-resolution-container";
import type { OwnershipTransferAction } from "./ownership-transfer-step-up-form";
import type { OwnershipTransferFormSchema } from "./schemas/ownership-transfer-form-schema";

type Resolution = Exclude<OwnershipTransferAction, "initiate">;

export function OwnershipTransferPanelContainer({ refreshKey = 0 }: { refreshKey?: number }) {
  const t = useTranslations("users.ownershipTransfer");
  const {
    resolveTransfer,
    refreshTransfer,
    isLoading,
    error,
    transferResult,
    currentTransfer,
    reset,
  } = useAdminSecurity();
  const [resolution, setResolution] = useState<{ action: Resolution; operationId: string } | null>(null);
  const loadedKey = useRef<number | null>(null);

  useEffect(() => {
    if (loadedKey.current === refreshKey) return;
    loadedKey.current = refreshKey;
    void refreshTransfer();
  }, [refreshKey, refreshTransfer]);

  const openResolution = useCallback((action: Resolution) => {
    reset();
    setResolution({ action, operationId: crypto.randomUUID() });
  }, [reset]);
  const closeResolution = useCallback(() => {
    if (isLoading) return;
    reset();
    setResolution(null);
  }, [isLoading, reset]);
  const submit = useCallback(async (values: OwnershipTransferFormSchema) => {
    if (!resolution || !currentTransfer) return;
    const succeeded = await resolveTransfer(resolution.action, {
      operationId: resolution.operationId,
      transferId: currentTransfer.id,
      password: values.password,
      totpCode: values.totpCode,
      confirmed: true,
    });
    if (!succeeded) {
      setResolution((current) => current
        ? { ...current, operationId: crypto.randomUUID() }
        : current);
    }
  }, [currentTransfer, resolution, resolveTransfer]);
  const completedStatus = transferResult?.transfer.status ?? null;

  return (
    <>
      <OwnershipTransferPanelPresentational
        transfer={currentTransfer}
        loading={isLoading}
        error={!resolution ? error : null}
        onResolve={openResolution}
      />
      <Modal
        open={Boolean(resolution)}
        onOpenChange={(open) => { if (!open) closeResolution(); }}
        title={resolution ? t(`${resolution.action}.title` as never) : undefined}
        description={resolution ? t(`${resolution.action}.description` as never) : undefined}
        closeLabel={t("closeDialog")}
        maxWidth="lg"
        maxHeight="xl"
        bodyClassName="px-0 py-0"
        showCloseButton={!isLoading}
        closeOnOverlayClick={!isLoading}
      >
        {resolution && currentTransfer && (
          <OwnershipTransferResolutionContainer
            key={`${currentTransfer.id}:${resolution.operationId}`}
            action={resolution.action}
            transfer={currentTransfer}
            loading={isLoading}
            error={error}
            completedStatus={completedStatus}
            onSubmit={submit}
            onClose={closeResolution}
          />
        )}
      </Modal>
    </>
  );
}
