"use client";

import { useFormatter, useTranslations } from "next-intl";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import ClientDetailsPresentational from "../../details/client-details-presentational";
import type { ClientCreationPreview } from "../../lib/types/client.types";

export default function ClientCreationPreviewView({ preview, loading, error, uncertain, expired, acknowledged, onAcknowledge, onConfirm, onBack, onReuse }: {
  preview: ClientCreationPreview;
  loading: boolean;
  error: string | null;
  uncertain: boolean;
  expired: boolean;
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
  onConfirm: () => void;
  onBack: () => void;
  onReuse: (id: string) => void;
}) {
  const t = useTranslations("clientForm");
  const format = useFormatter();
  const hasDuplicates = preview.duplicates.length > 0;
  const locked = loading || uncertain;
  const canConfirm = !loading && (uncertain || (!expired && (!hasDuplicates || acknowledged)));

  return (
    <section aria-label={t("previewTitle")} className="space-y-5 px-6 py-4">
      <div>
        <h2 className="font-semibold">{t("previewTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("previewHint")}</p>
      </div>
      {error && <AlertComponent title={error} variant="destructive" />}
      <ClientDetailsPresentational client={preview.client} />
      <p className="text-xs text-muted-foreground">
        {t("expiresAt", {
          date: format.dateTime(new Date(preview.expiresAt), {
            dateStyle: "short", timeStyle: "short", timeZone: "UTC",
          }),
        })}
      </p>
      {expired && !uncertain && <AlertComponent title={t("expired")} variant="destructive" />}
      {hasDuplicates && (
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">{t("duplicatesTitle", { count: preview.duplicates.length })}</h3>
          <p className="text-sm text-muted-foreground">{t("duplicatesHint")}</p>
          <ul className="space-y-2">
            {preview.duplicates.map((client) => (
              <li key={client.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 p-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{client.name}</p>
                  <p className="break-all text-muted-foreground">
                    {[client.email, client.phone, client.company].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => onReuse(client.id)}>
                  {t("useExisting", { name: client.name })}
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-start gap-2">
            <Checkbox
              id="acknowledge-client-duplicates"
              checked={acknowledged}
              disabled={locked}
              onCheckedChange={(value) => onAcknowledge(value === true)}
            />
            <Label htmlFor="acknowledge-client-duplicates" className="text-sm leading-relaxed">
              {t("acknowledgeDuplicates")}
            </Label>
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" disabled={locked} onClick={onBack}>{t("back")}</Button>
        <Button type="button" disabled={!canConfirm} onClick={onConfirm}>
          {t(loading ? "confirming" : uncertain ? "retryConfirmation" : "confirm")}
        </Button>
      </div>
    </section>
  );
}
