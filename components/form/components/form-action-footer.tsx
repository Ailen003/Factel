"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";


interface FormActionFooterProps {
  loading: boolean;
  onCancel: () => void;
  cancelButtonText?: string;
  submitButtonText?: string;
  loadingText?: string;
}

export default function FormActionFooter({
  loading,
  onCancel,
  cancelButtonText = "Cancelar",
  submitButtonText = "Guardar",
  loadingText = "Guardando...",
}: FormActionFooterProps) {
  return (
    <div className="px-4 w-full z-10 flex h-full gap-3 border-t border-border bg-card pt-6  flex-row justify-end shrink-0">
      <Button
        type="button"
        variant="outline"
        disabled={loading}
        onClick={onCancel}
        className="w-auto bg-transparent"
      >
        {cancelButtonText}
      </Button>
      <Button
        type="submit"
        variant={"default"}
        disabled={loading}
        className="w-auto"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingText}
          </>
        ) : (
          submitButtonText
        )}
      </Button>
    </div>
  );
}

