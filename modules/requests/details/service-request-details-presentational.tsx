"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { ServiceRequestDetails } from "../lib/types/service-request.types";

export default function ServiceRequestDetailsPresentational({ request }: { request: ServiceRequestDetails }) {
  const t = useTranslations("requests");
  const format = useFormatter();
  const values = {
    client: request.client.name, title: request.title, description: request.description,
    serviceType: t(`serviceTypes.${request.serviceType}`), priority: t(`priorities.${request.priority}`),
    status: t(`statuses.${request.status}`), preferredSchedule: request.preferredSchedule,
    serviceAddress: request.serviceAddress, nextSteps: request.nextSteps,
    createdAt: format.dateTime(new Date(request.createdAt), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }),
    updatedAt: format.dateTime(new Date(request.updatedAt), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }),
  };
  return <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {(Object.keys(values) as Array<keyof typeof values>).map((field) => <div key={field}
      className={["description", "serviceAddress", "nextSteps"].includes(field) ? "sm:col-span-2" : ""}>
      <dt className="text-sm font-medium text-muted-foreground">{t(`fields.${field}` as never)}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{values[field] || t("notProvided")}</dd>
    </div>)}
  </dl>;
}
