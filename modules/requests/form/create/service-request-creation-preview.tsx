"use client";

import { useFormatter, useTranslations } from "next-intl";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import type { ServiceRequestCreationPreview } from "../../lib/types/service-request.types";

export default function ServiceRequestCreationPreviewView({ preview, loading, error, uncertain, expired, onConfirm, onBack }: {
  preview: ServiceRequestCreationPreview; loading: boolean; error: string | null; uncertain: boolean;
  expired: boolean; onConfirm: () => void; onBack: () => void;
}) {
  const t = useTranslations("requestForm"); const requests = useTranslations("requests"); const format = useFormatter();
  const values = { client: preview.client.name, title: preview.request.title, description: preview.request.description,
    serviceType: requests(`serviceTypes.${preview.request.serviceType}`), priority: requests(`priorities.${preview.request.priority}`),
    status: requests("statuses.pending"), preferredSchedule: preview.request.preferredSchedule,
    serviceAddress: preview.request.serviceAddress, nextSteps: preview.request.nextSteps };
  const locked = loading || uncertain; const canConfirm = !loading && (uncertain || !expired);
  return <section aria-label={t("previewTitle")} className="space-y-5 px-6 py-4">
    <div><h2 className="font-semibold">{t("previewTitle")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("previewHint")}</p></div>
    {error && <AlertComponent title={error} variant="destructive" />}
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{(Object.keys(values) as Array<keyof typeof values>).map((field) => <div key={field}
      className={["description", "serviceAddress", "nextSteps"].includes(field) ? "sm:col-span-2" : ""}>
      <dt className="text-sm font-medium text-muted-foreground">{requests(`fields.${field}` as never)}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{values[field] || requests("notProvided")}</dd>
    </div>)}</dl>
    <p className="text-xs text-muted-foreground">{t("expiresAt", { date: format.dateTime(new Date(preview.expiresAt),
      { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }) })}</p>
    {expired && !uncertain && <AlertComponent title={t("expired")} variant="destructive" />}
    <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
      <Button type="button" variant="outline" disabled={locked} onClick={onBack}>{t("back")}</Button>
      <Button type="button" disabled={!canConfirm} onClick={onConfirm}>{t(loading ? "confirming" : uncertain ? "retryConfirmation" : "confirm")}</Button>
    </div>
  </section>;
}
