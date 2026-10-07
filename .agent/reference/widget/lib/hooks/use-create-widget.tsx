"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createWidgetAction } from "../actions/widget.actions";
import { WidgetDetails } from "../types/widget.types";
import { CreateWidgetSchema } from "../../form/create/schemas/create-widget-schema";

interface Props {
  onSuccess?: (widget: WidgetDetails) => void;
}

export function useCreateWidget({ onSuccess }: Props = {}) {
  const t = useTranslations("widgets");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widget, setWidget] = useState<WidgetDetails | null>(null);

  const createWidget = useCallback(async (schema: CreateWidgetSchema) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await createWidgetAction(schema);
      if (!response.success) {
        const code = response.error.code as string;
        const translated = t.has(`errors.${code}`)
          ? t(`errors.${code}`)
          : response.error.message;
        setError(translated);
        return;
      }
      setWidget(response.data);
      onSuccess?.(response.data);
      return response.data;
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, t]);

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
    setWidget(null);
  }, []);

  return { createWidget, isLoading, error, widget, reset };
}
