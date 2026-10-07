"use client";

import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import type { User } from "../lib/types/user.types";
import { useTemporaryCredentialReissue } from "../lib/hooks/use-temporary-credential-reissue";
import { CredentialIssuanceBadge } from "../components/credential-issuance-badge";
import { CredentialDeliveryForm } from "./credential-delivery-form";

export function CredentialDeliveryConfirmation({
  user,
  onClose,
  onBusyChange,
}: {
  user: User;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = useTranslations("users.credentialReissue");
  const { confirmDelivery, deliveryResult, isLoading, error, reset } =
    useTemporaryCredentialReissue();
  const issuance = user.latestTemporaryCredentialIssuance;

  useEffect(() => {
    onBusyChange?.(isLoading);
  }, [isLoading, onBusyChange]);

  useEffect(() => () => {
    reset();
    onBusyChange?.(false);
  }, [onBusyChange, reset]);

  if (!issuance || issuance.status !== "issued" || issuance.deliveredAt) {
    return (
      <div className="space-y-4 px-6 py-5">
        <AlertComponent title={t("deliveryNoLongerAvailable")} />
        <Button type="button" className="w-full sm:w-auto" onClick={onClose}>
          {t("done")}
        </Button>
      </div>
    );
  }

  if (deliveryResult) {
    return (
      <div className="space-y-5 px-6 py-5">
        <div
          className="flex items-start gap-3 rounded-md border border-green-300 bg-green-50 p-4 text-green-950 dark:border-green-800 dark:bg-green-950/30 dark:text-green-100"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">{t("deliveryConfirmedTitle")}</p>
            <p className="mt-1 text-sm">
              {t("deliveryConfirmedDescription", {
                channel: t(`channels.${deliveryResult.issuance.deliveryChannel ?? "other"}`),
              })}
            </p>
          </div>
        </div>
        <Button type="button" className="w-full sm:w-auto" onClick={onClose}>
          {t("done")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-6 py-5">
      <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{user.fullName}</p>
          <p className="text-xs text-muted-foreground">{t("deferredDeliveryNotice")}</p>
        </div>
        <CredentialIssuanceBadge issuance={issuance} />
      </div>
      <CredentialDeliveryForm
        loading={isLoading}
        error={error}
        onConfirm={(channel) => confirmDelivery({
          issuanceId: issuance.id,
          expectedVersion: issuance.version,
          channel,
          confirmed: true,
        })}
      />
      <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose} disabled={isLoading}>
        {t("cancel")}
      </Button>
    </div>
  );
}
