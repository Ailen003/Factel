"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { deleteWidgetAction } from "../actions/widget.actions";

interface Props {
  onSuccess?: () => void;
}

export function useDeleteWidget({ onSuccess }: Props = {}) {
  const t = useTranslations("widgets");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteWidget = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await deleteWidgetAction(id);
      if (!response.success) {
        const code = response.error.code as string;
        const translated = t.has(`errors.${code}`)
          ? t(`errors.${code}`)
          : response.error.message;
        setError(translated);
        return;
      }
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, t]);

  return { deleteWidget, isLoading, error };
}
