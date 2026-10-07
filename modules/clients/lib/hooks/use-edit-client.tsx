"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { editClientAction } from "../actions/client.actions";
import { convertCreateClientDto, type ClientDuplicateCandidate } from "../types/client.types";
import type { EditClientSchema } from "../../form/edit/schemas/edit-client-schema";

function readDuplicates(value: unknown): ClientDuplicateCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ClientDuplicateCandidate =>
    typeof item === "object" && item !== null && typeof (item as ClientDuplicateCandidate).id === "string" &&
    typeof (item as ClientDuplicateCandidate).name === "string" && typeof (item as ClientDuplicateCandidate).version === "number");
}

export function useEditClient(onSuccess: () => void) {
  const t = useTranslations("clients");
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<ClientDuplicateCandidate[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const save = useCallback(async (id: string, expectedVersion: number, values: EditClientSchema) => {
    if (isLoading || (duplicates.length > 0 && !acknowledged)) return;
    setLoading(true); setError(null);
    try {
      const response = await editClientAction({ id, expectedVersion, acknowledgeDuplicates: acknowledged,
        client: convertCreateClientDto(values) });
      if (response.success) { onSuccess(); return; }
      if (response.error.code === "DUPLICATE_ACKNOWLEDGMENT_REQUIRED") {
        setDuplicates(readDuplicates("details" in response.error ? response.error.details?.duplicates : undefined));
        setAcknowledged(false);
      }
      const key = `errors.${response.error.code}`;
      setError(t.has(key as never) ? t(key as never) : t("errors.INTERNAL_ERROR"));
    } catch { setError(t("errors.INTERNAL_ERROR")); }
    finally { setLoading(false); }
  }, [acknowledged, duplicates.length, isLoading, onSuccess, t]);
  const acknowledge = useCallback((value: boolean) => { setAcknowledged(value); setError(null); }, []);
  const resetDuplicates = useCallback(() => { setDuplicates([]); setAcknowledged(false); setError(null); }, []);
  return { save, isLoading, error, duplicates, acknowledged, acknowledge, resetDuplicates };
}
