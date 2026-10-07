"use client";
import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import {
  X,
  Upload,
  Loader2,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  FileCode,
  FileAudio,
  FileVideo,
  File as FileIconGeneric,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/images";


// Obtener icono según MIME type
function getFileTypeIcon(mimeType: string) {
  const iconClass = "w-8 h-8";

  if (mimeType.startsWith("image/"))
    return <FileImage className={cn(iconClass, "text-blue-500")} />;
  if (mimeType === "application/pdf")
    return <FileText className={cn(iconClass, "text-red-500")} />;
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  )
    return <FileSpreadsheet className={cn(iconClass, "text-green-600")} />;
  if (
    mimeType.includes("wordprocessing") ||
    mimeType.includes("msword") ||
    mimeType === "text/plain"
  )
    return <FileText className={cn(iconClass, "text-blue-600")} />;
  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("compressed")
  )
    return <FileArchive className={cn(iconClass, "text-yellow-600")} />;
  if (mimeType.startsWith("audio/"))
    return <FileAudio className={cn(iconClass, "text-purple-500")} />;
  if (mimeType.startsWith("video/"))
    return <FileVideo className={cn(iconClass, "text-pink-500")} />;
  if (
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("javascript") ||
    mimeType.includes("html")
  )
    return <FileCode className={cn(iconClass, "text-orange-500")} />;

  return <FileIconGeneric className={cn(iconClass, "text-gray-500")} />;
}

// Obtener extensión legible
function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toUpperCase();
  return ext || "FILE";
}

// Obtener color de badge según extensión
function getExtensionColor(mimeType: string): string {
  if (mimeType.startsWith("image/"))
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  if (mimeType === "application/pdf")
    return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  )
    return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  if (mimeType.includes("wordprocessing") || mimeType.includes("msword"))
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  if (mimeType.includes("zip") || mimeType.includes("compressed"))
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
  if (mimeType.startsWith("audio/"))
    return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
  if (mimeType.startsWith("video/"))
    return "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300";
  return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}

interface FileWithPreview extends File {
  preview?: string;
  id: string;
}

interface MultiFileUploadProps {
  name: string;
  label?: string;
  maxSize?: number; // in bytes
  maxFiles?: number;
  className?: string;
  error?: string;
  loading?: boolean;
  quality?: number;
  maxWidth?: number;
  acceptedFileTypes?: Record<string, string[]>;
  compressImages?: boolean;
}

export function RHFMultiFileUpload({
  name,
  label,
  maxSize = 5 * 1024 * 1024, // 5MB default
  maxFiles = 5,
  className,
  error,
  loading = false,
  quality = 80,
  maxWidth = 1920,
  acceptedFileTypes = {
    "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"],
    "application/pdf": [".pdf"],
    "text/*": [".txt", ".csv"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
      ".docx",
    ],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
      ".xlsx",
    ],
  },
  compressImages = true,
}: MultiFileUploadProps) {
  const { setValue, watch, formState } = useFormContext();
  const t = useTranslations('multiFileUpload');
  const value: FileWithPreview[] = watch(name);
  const fieldError = error || formState.errors[name]?.message;
  const displayLabel = label || t('uploadFiles');

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(
    new Set(),
  );

  // Estado local para previews
  const [previews, setPreviews] = useState<{ [id: string]: string }>({});

  // Generar previews cuando cambia value
  useEffect(() => {
    if (!value || !Array.isArray(value)) {
      const timeoutId = setTimeout(() => setPreviews({}), 0);
      return () => clearTimeout(timeoutId);
    }
    const newPreviews: { [id: string]: string } = {};
    value.forEach((file) => {
      if (file.type && file.type.startsWith("image/") && file instanceof File) {
        newPreviews[file.name] = URL.createObjectURL(file);
      }
    });
    const timeoutId = setTimeout(() => setPreviews(newPreviews), 0);
    // Limpiar las URLs cuando cambie value o al desmontar
    return () => {
      clearTimeout(timeoutId);
      Object.values(newPreviews).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [value]);

  const processFile = useCallback(
    async (file: File): Promise<FileWithPreview> => {
      const fileId = `${file.name}-${Date.now()}-${Math.random()}`;

      // Si es una imagen y está habilitada la compresión
      if (file.type.startsWith("image/") && compressImages) {
        try {
          const compressedFile = await compressImage(file, {
            quality,
            maxWidth,
            format: "webp",
          });

          // Cambiar el nombre del archivo a .webp
          const originalName =
            file.name.split(".").slice(0, -1).join(".") || file.name;
          const webpName = originalName + ".webp";
          const processedFile = new File([compressedFile], webpName, {
            type: compressedFile.type,
          }) as FileWithPreview;

          processedFile.id = fileId;

          // Crear preview para imágenes
          processedFile.preview = URL.createObjectURL(processedFile);

          return processedFile;
        } catch (err) {
          console.error("Error compressing image:", err);
        }
      }

      // Para archivos no imagen o si falla la compresión
      const fileWithPreview = file as FileWithPreview;
      fileWithPreview.id = fileId;

      // Crear preview solo para imágenes
      if (file.type.startsWith("image/")) {
        fileWithPreview.preview = URL.createObjectURL(file);
      }

      return fileWithPreview;
    },
    [quality, maxWidth, compressImages],
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      accept: acceptedFileTypes,
      maxSize,
      multiple: true,
      disabled: loading || isProcessing,
      onDrop: async (acceptedFiles) => {
        if (acceptedFiles?.length) {
          // Verificar que no exceda el máximo de archivos
          const totalFiles = value.length + acceptedFiles.length;
          if (totalFiles > maxFiles) {
            return;
          }

          setIsProcessing(true);

          try {
            const processedFiles: FileWithPreview[] = [];

            for (const file of acceptedFiles) {
              setProcessingFiles((prev) => new Set(prev).add(file.name));
              const processedFile = await processFile(file);
              processedFiles.push(processedFile);
              setProcessingFiles((prev) => {
                const newSet = new Set(prev);
                newSet.delete(file.name);
                return newSet;
              });
            }

            setValue(name, [...value, ...processedFiles], {
              shouldValidate: true,
            });
          } catch (err) {
            console.error("Error processing files:", err);
          } finally {
            setIsProcessing(false);
          }
        }
      },
    });

  // Limpiar URLs de preview cuando el componente se desmonte
  useEffect(() => {
    return () => {
      value.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [value]);

  // Manejar eliminación de archivo individual
  const handleRemoveFile = (fileId: string) => {
    if (loading || isProcessing) return;

    const fileToRemove = value.find((f) => f.name === fileId);
    if (fileToRemove?.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }

    const updatedFiles = value.filter((file) => file.name !== fileId);
    setValue(name, updatedFiles, { shouldValidate: true });
  };

  // Limpiar todos los archivos
  const handleClearAll = () => {
    if (loading || isProcessing) return;

    value.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });

    setValue(name, [], { shouldValidate: true });
  };

  // Formatear tamaño de archivo
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    );
  };

  // Obtener errores de rechazo de archivos
  const fileRejectionError = fileRejections[0]?.errors[0]?.message;
  const maxFilesError =
    value.length >= maxFiles ? t('maxFilesAllowed', { maxFiles }) : null;

  return (
    <div className={cn("space-y-4", className)}>
      {displayLabel && <p className="text-xs font-medium sm:text-sm">{displayLabel}</p>}

      {/* Área de drop */}
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900/30",
          "h-32",
          (fieldError || fileRejectionError || maxFilesError) &&
            "border-red-500",
          loading || isProcessing ? "cursor-wait opacity-70" : "cursor-pointer",
          value.length >= maxFiles && "opacity-50 cursor-not-allowed",
        )}
      >
        <input
          {...getInputProps()}
          disabled={loading || isProcessing || value.length >= maxFiles}
        />

        {(loading || isProcessing) && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-lg">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground sm:text-sm">
                {t('processingFiles')}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          {isDragActive ? (
            <>
              <Upload className="w-10 h-10 text-primary" />
              <p className="text-xs text-foreground dark:text-foreground sm:text-sm">
                {t('dropFilesHere')}
              </p>
            </>
          ) : (
            <>
              <Upload
                className={cn(
                  "w-10 h-10 text-primary",
                  (loading || isProcessing) && "opacity-50",
                )}
              />
              <p className="text-xs text-foreground dark:text-secondary sm:text-sm">
                {value.length >= maxFiles
                  ? t('maxFilesReached', { maxFiles })
                  : t('dragAndDropOrClick')}
              </p>
              <p className="text-[10px] text-foreground dark:text-foreground sm:text-xs">
                {t('fileSizeInfo', {
                  maxSize: Math.round(maxSize / (1024 * 1024)),
                  remaining: maxFiles - value.length
                })}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Lista de archivos subidos */}
      {value.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium sm:text-sm">
              {t('uploadedFiles', { count: value.length, max: maxFiles })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={loading || isProcessing}
            >
              {t('clearAll')}
            </Button>
          </div>

          <div className="grid gap-3 max-h-64 overflow-y-auto">
            {value.map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-4 p-3 border rounded-lg bg-gray-50 dark:bg-gray-900/30"
              >
                {/* Preview o icono */}
                <div className="shrink-0">
                  {file.type.startsWith("image/") && previews[file.name] ? (
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900/30">
                      <Image
                        src={previews[file.name] || "/placeholder.svg"}
                        alt={file.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-14 h-14 rounded-lg border bg-gray-50 dark:bg-gray-900/30">
                      {getFileTypeIcon(file.type)}
                    </div>
                  )}
                </div>

                {/* Información del archivo */}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-xs font-medium truncate text-foreground sm:text-sm">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium sm:text-xs",
                        getExtensionColor(file.type),
                      )}
                    >
                      {getFileExtension(file.name)}
                    </span>
                    <span className="text-[10px] text-muted-foreground sm:text-xs">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  {processingFiles.has(file.name) && (
                    <p className="text-[10px] text-blue-500 flex items-center gap-1 sm:text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t('processing')}
                    </p>
                  )}
                </div>

                {/* Botón eliminar */}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemoveFile(file.name)}
                  disabled={loading || isProcessing}
                  className="shrink-0 h-8 w-8 p-0 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errores */}
      {(fieldError || fileRejectionError || maxFilesError) && (
        <p className="text-xs text-red-500 sm:text-sm">
          {typeof fieldError === "string"
            ? fieldError
            : fileRejectionError || maxFilesError}
        </p>
      )}
    </div>
  );
}
