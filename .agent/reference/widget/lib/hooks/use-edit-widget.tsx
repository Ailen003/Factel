"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { editWidgetAction } from "../actions/widget.actions";
import { WidgetDetails } from "../types/widget.types";
import { EditWidgetSchema } from "../../form/edit/schemas/edit-widget-schema";

interface Props {
  onSuccess?: (widget: WidgetDetails) => void;
}

export function useEditWidget({ onSuccess }: Props = {}) {
  const t = useTranslations("widgets");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editWidget = useCallback(async (widgetId: string, schema: EditWidgetSchema) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await editWidgetAction(widgetId, schema);
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

  const reset = useCallback(() => { setError(null); setIsLoading(false); }, []);

  return { editWidget, isLoading, error, reset };
}
