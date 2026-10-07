"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { getWidgetByIdAction } from "../actions/widget.actions";
import { WidgetDetails } from "../types/widget.types";

interface Props {
  widgetId: string;
}

export function useWidget({ widgetId }: Props) {
  const t = useTranslations("widgets");
  const [widget, setWidget] = useState<WidgetDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWidget = useCallback(async () => {
    if (!widgetId) return;
    setIsLoading(true);
    setError(null);
    setWidget(null);
    try {
      const response = await getWidgetByIdAction(widgetId);
      if (!response.success) {
        const code = response.error.code as string;
        const translated = t.has(`errors.${code}`)
          ? t(`errors.${code}`)
          : response.error.message;
        setError(translated);
        return;
      }
      setWidget(response.data);
    } finally {
      setIsLoading(false);
    }
  }, [widgetId, t]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchWidget();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchWidget]);

  return { widget, isLoading, error, refetch: fetchWidget };
}
