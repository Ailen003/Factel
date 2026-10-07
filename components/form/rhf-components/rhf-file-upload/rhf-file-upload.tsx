"use client";

import { useCallback, type ReactNode } from "react";
import { File as FileIcon, Loader2, Upload, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface FileUploadMessages {
  choose: string;
  drop: string;
  acceptedTypes: string;
  processing: string;
  remove: string;
  selected: string;
  size: (megabytes: string) => string;
  rejectedType: string;
  rejectedSize: string;
  rejectedOther: string;
  progress?: (percent: number) => string;
}

interface FileUploadProps {
  name: string;
  messages: FileUploadMessages;
  label?: string;
  maxSize?: number;
  className?: string;
  error?: string;
  loading?: boolean;
  progress?: number;
  accept?: Record<string, string[]>;
  description?: string;
  disabled?: boolean;
  icon?: ReactNode;
}

function megabytes(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(bytes < 1024 * 1024 ? 2 : 1);
}

export function RHFFileUpload({ name, messages, maxSize = 10 * 1024 * 1024, className, error,
  loading = false, progress, accept, description, disabled = false, icon, label }: FileUploadProps) {
  const { setValue, watch, formState } = useFormContext();
  const value = watch(name) as File | undefined;
  const fieldError = error || formState.errors[name]?.message;
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) setValue(name, acceptedFiles[0], { shouldDirty: true, shouldValidate: true });
  }, [name, setValue]);
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept, maxSize, multiple: false, disabled: disabled || loading, onDrop,
  });
  const rejection = fileRejections[0]?.errors[0]?.code;
  const rejectionMessage = rejection === "file-too-large" ? messages.rejectedSize
    : rejection === "file-invalid-type" ? messages.rejectedType
      : rejection ? messages.rejectedOther : null;
  const progressLabel = progress !== undefined ? (messages.progress?.(progress) ?? `${progress}%`) : messages.processing;

  return <div className={cn("space-y-2", className)}>
    {label && <p className="text-sm font-medium">{label}</p>}
    <div {...getRootProps()} className={cn(
      "relative flex min-h-40 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
      isDragActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
      (fieldError || rejectionMessage) && "border-destructive",
      disabled || loading ? "cursor-not-allowed opacity-70" : "cursor-pointer",
    )}>
      <input {...getInputProps()} aria-label={label ?? messages.choose} />
      {loading && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/90 px-6">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium" role="status">{progressLabel}</p>
        {progress !== undefined && <Progress value={progress} aria-label={progressLabel} className="max-w-xs" />}
      </div>}
      {value ? <div className="flex w-full items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border bg-muted">
          {icon ?? <FileIcon className="h-7 w-7 text-primary" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{value.name}</p>
          <p className="text-xs text-muted-foreground">{messages.size(megabytes(value.size))}</p>
          <span className="sr-only">{messages.selected}</span>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled || loading}
          aria-label={messages.remove} onClick={(event) => {
            event.stopPropagation();
            setValue(name, undefined, { shouldDirty: true, shouldValidate: true });
          }}><X className="h-4 w-4" aria-hidden /></Button>
      </div> : <div className="space-y-2 text-center">
        <Upload className="mx-auto h-9 w-9 text-primary" aria-hidden />
        <p className="text-sm font-medium">{isDragActive ? messages.drop : messages.choose}</p>
        <p className="text-xs text-muted-foreground">{messages.acceptedTypes}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>}
    </div>
    {(fieldError || rejectionMessage) && <p className="text-sm text-destructive" role="alert">
      {typeof fieldError === "string" ? fieldError : rejectionMessage}
    </p>}
  </div>;
}
