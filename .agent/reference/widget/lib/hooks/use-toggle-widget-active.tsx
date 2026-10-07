"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toggleWidgetActiveAction } from "../actions/widget.actions";
import { WidgetDetails } from "../types/widget.types";

interface Props {
  onSuccess?: (widget: WidgetDetails) => void;
}

export function useToggleWidgetActive({ onSuccess }: Props = {}) {
  const t = useTranslations("widgets");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleWidgetActive = useCallback(async (id: string, isActive: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await toggleWidgetActiveAction(id, isActive);
      if (!response.success) {
        const code = response.error.code as string;
        const translated = t.has(`errors.${code}`)
          ? t(`errors.${code}`)
          : response.error.message;
        setError(translated);
        return;
      }
      onSuccess?.(response.data);
      return response.data;
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, t]);

  return { toggleWidgetActive, isLoading, error };
}
