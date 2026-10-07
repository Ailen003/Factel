"use client";

import { urlToFile } from "@/lib/images";
import { useCallback, useEffect, useRef, useState } from "react";
import { Path, UseFormReturn } from "react-hook-form";

interface Props<T extends Record<string, any>> {
  form: UseFormReturn<T>;
  documentUrl?: string;
  documentName?: string;
  fieldName: Path<T>;
}

export default function useDocumentForm<T extends Record<string, any>>({
  form,
  documentUrl,
  documentName,
  fieldName,
}: Props<T>) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  const fieldNameRef = useRef(fieldName);
  const documentUrlRef = useRef(documentUrl);
  const documentNameRef = useRef(documentName);

  const fetchDocument = useCallback(async () => {
    if (hasProcessed.current) return;

    if (!documentUrlRef.current) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const currentValue = form.getValues(fieldNameRef.current);

      if (!currentValue && documentUrlRef.current) {
        hasProcessed.current = true;
        const file = await urlToFile(documentUrlRef.current, documentNameRef.current);
        form.setValue(fieldNameRef.current, file as any, {
          shouldDirty: false,
          shouldValidate: false,
        });
      }
    } catch (err) {
      console.error("[use-document-form] Failed to load document:", err);
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchDocument();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [fetchDocument]);

  return {
    loading,
    error,
    fetchDocument,
  };
}
