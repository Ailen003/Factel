"use client";

import { ArrowRightLeft, Clock3, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { AlertComponent } from "@/components/ui/alert-component";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OwnershipTransferView } from "../lib/types/admin-security.types";
import type { OwnershipTransferAction } from "./ownership-transfer-step-up-form";

export function OwnershipTransferPanelPresentational({
  transfer,
  loading,
  error,
  onResolve,
}: {
  transfer: OwnershipTransferView | null;
  loading: boolean;
  error: string | null;
  onResolve: (action: Exclude<OwnershipTransferAction, "initiate">) => void;
}) {
  const t = useTranslations("users.ownershipTransfer");

  if (loading && !transfer) {
    return (
      <div role="status" className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("loading")}
      </div>
    );
  }
  if (!transfer && !error) return null;

  return (
    <section aria-labelledby="ownership-transfer-heading" className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 id="ownership-transfer-heading" className="font-semibold">{t("panelTitle")}</h2>
            {transfer && <Badge variant="outline">{t(`status.${transfer.status}` as never)}</Badge>}
          </div>
          {error && <AlertComponent title={error} variant="destructive" />}
          {transfer && (
            <>
              <p className="text-sm">
                {t("summary", { owner: transfer.ownerName, target: transfer.targetName })}
              </p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                {t("expiresAt", { date: new Date(transfer.expiresAt).toLocaleString() })}
              </p>
              <p className="text-xs text-muted-foreground">{t(`statusHelp.${transfer.status}` as never)}</p>
            </>
          )}
        </div>

        {transfer && transfer.status === "pending" && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {transfer.canCancel && (
              <Button type="button" variant="outline" disabled={loading} onClick={() => onResolve("cancel")}>
                {t("cancel.submit")}
              </Button>
            )}
            {transfer.canDecline && (
              <Button type="button" variant="outline" disabled={loading} onClick={() => onResolve("decline")}>
                {t("decline.submit")}
              </Button>
            )}
            {transfer.canAccept && (
              <Button type="button" disabled={loading} onClick={() => onResolve("accept")}>
                {t("accept.submit")}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
