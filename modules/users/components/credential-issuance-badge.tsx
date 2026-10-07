"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { TemporaryCredentialIssuanceMetadata } from "../lib/types/temporary-credential-reissue.types";

export type CredentialIssuanceDisplayStatus =
  | "prepared"
  | "issuedNotDelivered"
  | "delivered"
  | "superseded"
  | "failed";

export function getCredentialIssuanceDisplayStatus(
  issuance: TemporaryCredentialIssuanceMetadata,
): CredentialIssuanceDisplayStatus {
  if (issuance.status === "superseded") return "superseded";
  if (issuance.status === "failed") return "failed";
  if (issuance.status === "prepared") return "prepared";
  return issuance.deliveredAt ? "delivered" : "issuedNotDelivered";
}

const statusClasses: Record<CredentialIssuanceDisplayStatus, string> = {
  prepared: "border-amber-300 bg-amber-50 text-amber-800",
  issuedNotDelivered: "border-amber-300 bg-amber-50 text-amber-800",
  delivered: "border-green-300 bg-green-50 text-green-800",
  superseded: "border-gray-300 bg-gray-50 text-gray-700",
  failed: "border-red-300 bg-red-50 text-red-800",
};

export function CredentialIssuanceBadge({
  issuance,
}: {
  issuance: TemporaryCredentialIssuanceMetadata;
}) {
  const t = useTranslations("users.credentialReissue.status");
  const status = getCredentialIssuanceDisplayStatus(issuance);
  return (
    <Badge variant="outline" className={statusClasses[status]}>
      {t(status)}
    </Badge>
  );
}
