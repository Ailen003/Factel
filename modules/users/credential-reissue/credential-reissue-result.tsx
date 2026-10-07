"use client";

import { CheckCircle2, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import { CredentialIssuanceBadge } from "../components/credential-issuance-badge";
import { TemporaryCredentialDisplay } from "../components/temporary-credential-display";
import type {
  ConfirmTemporaryCredentialDeliveryDto,
  ReissuedTemporaryCredentialResult,
} from "../lib/types/temporary-credential-reissue.types";
import { CredentialDeliveryForm } from "./credential-delivery-form";

export function CredentialReissueResult({
  email,
  result,
  loading,
  error,
  onConfirmDelivery,
  onDone,
}: {
  email: string;
  result: ReissuedTemporaryCredentialResult;
  loading: boolean;
  error: string | null;
  onConfirmDelivery: (input: ConfirmTemporaryCredentialDeliveryDto) => Promise<void>;
  onDone: () => void;
}) {
  const t = useTranslations("users.credentialReissue");
  const delivered = Boolean(result.issuance.deliveredAt);

  if (!result.issuance.expiresAt) {
    return (
      <div className="space-y-4 px-6 py-5">
        <AlertComponent title={t("missingExpiryError")} variant="destructive" />
        <Button type="button" className="w-full sm:ml-auto sm:w-auto" onClick={onDone}>
          {t("done")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-6 py-5">
      {result.suspended && (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">{t("suspendedTitle")}</p>
            <p className="mt-1 text-sm">{t("suspendedWarning")}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{t("issuanceState")}</p>
          <p className="text-xs text-muted-foreground">
            {t("revokedSessions", { count: result.revokedSessions })}
          </p>
        </div>
        <CredentialIssuanceBadge issuance={result.issuance} />
      </div>

      <TemporaryCredentialDisplay
        email={email}
        temporaryPassword={result.temporaryPassword}
        expiresAt={result.issuance.expiresAt}
      />

      {delivered ? (
        <div className="flex items-start gap-3 rounded-md border border-green-300 bg-green-50 p-4 text-green-950 dark:border-green-800 dark:bg-green-950/30 dark:text-green-100" role="status">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">{t("deliveryConfirmedTitle")}</p>
            <p className="mt-1 text-sm">
              {t("deliveryConfirmedDescription", {
                channel: t(`channels.${result.issuance.deliveryChannel ?? "other"}` as never),
              })}
            </p>
          </div>
        </div>
      ) : (
        <CredentialDeliveryForm
          loading={loading}
          error={error}
          onConfirm={(channel) => onConfirmDelivery({
            issuanceId: result.issuance.id,
            expectedVersion: result.issuance.version,
            channel,
            confirmed: true,
          })}
        />
      )}

      <Button type="button" variant={delivered ? "default" : "outline"} className="w-full sm:ml-auto sm:w-auto" onClick={onDone} disabled={loading}>
        {delivered ? t("done") : t("closeWithoutDelivery")}
      </Button>
    </div>
  );
}
