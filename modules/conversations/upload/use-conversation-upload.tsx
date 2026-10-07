"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  completeConversationUploadAction,
  discardConversationUploadAction,
  prepareConversationRecordingAction,
  prepareConversationUploadAction,
} from "../lib/actions/conversation.actions";
import type { ConversationMutationResult, ConversationSourceType, PreparedConversationUpload } from "../lib/types/conversation.types";
import { normalizeConversationMimeType, type ConversationUploadSchema } from "./schemas/conversation-upload-schema";
import type { ConversationUploadPolicy } from "../lib/types/conversation.types";

export type ConversationUploadStage = "idle" | "preparing" | "uploading" | "verifying" | "discarding" | "failed" | "success";

function sendFile(prepared: PreparedConversationUpload, file: File, xhrRef: React.MutableRefObject<XMLHttpRequest | null>, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("PUT", prepared.uploadUrl);
    xhr.setRequestHeader("Content-Type", prepared.requiredContentType);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("UPLOAD_FAILED")));
    xhr.addEventListener("error", () => reject(new Error("UPLOAD_FAILED")));
    xhr.addEventListener("abort", () => reject(new DOMException("Upload cancelled", "AbortError")));
    xhr.send(file);
  }).finally(() => { xhrRef.current = null; });
}

export default function useConversationUpload({ onSuccess, onLockChange, policy, sourceType = "upload" }: {
  onSuccess: (result: ConversationMutationResult) => void;
  onLockChange: (locked: boolean) => void;
  policy: ConversationUploadPolicy;
  sourceType?: ConversationSourceType;
}) {
  const t = useTranslations("conversations");
  const [stage, setStage] = useState<ConversationUploadStage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedConversationUpload | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const mountedRef = useRef(true);
  const prepareAttemptRef = useRef<{ intent: string; idempotencyKey: string } | null>(null);
  const transferCompletedRef = useRef(false);
  const abortActiveUpload = useCallback(() => { xhrRef.current?.abort(); }, []);
  const locked = stage === "preparing" || stage === "uploading" || stage === "verifying" || stage === "discarding"
    || (stage === "failed" && Boolean(prepared));
  useEffect(() => { onLockChange(locked); }, [locked, onLockChange]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; abortActiveUpload(); };
  }, [abortActiveUpload]);

  const clearAttempt = useCallback(() => {
    prepareAttemptRef.current = null;
    transferCompletedRef.current = false;
    setPrepared(null);
    setSelectedFile(null);
  }, []);

  const translateError = useCallback((code: string) => t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.INTERNAL_ERROR"), [t]);
  const discard = useCallback(async (upload = prepared) => {
    if (!upload) return true;
    setStage("discarding");
    try {
      const response = await discardConversationUploadAction({ conversationId: upload.conversationId, grantId: upload.grantId, expectedVersion: upload.version });
      if (!mountedRef.current) return false;
      if (!response.success) { setStage("failed"); setError(translateError(response.error.code)); return false; }
      clearAttempt(); setStage("idle"); setProgress(0); setError(null);
      return true;
    } catch {
      if (mountedRef.current) { setStage("failed"); setError(translateError("INTERNAL_ERROR")); }
      return false;
    }
  }, [clearAttempt, prepared, translateError]);

  const transferAndComplete = useCallback(async (upload: PreparedConversationUpload, file: File) => {
    setError(null);
    try {
      if (!transferCompletedRef.current) {
        setStage("uploading"); setProgress(0);
        await sendFile(upload, file, xhrRef, setProgress);
        if (!mountedRef.current) return;
        transferCompletedRef.current = true;
      }
      setStage("verifying");
      const response = await completeConversationUploadAction({ conversationId: upload.conversationId, grantId: upload.grantId });
      if (!mountedRef.current) return;
      if (!response.success) {
        const retryable = response.error.code === "UPLOAD_INCOMPLETE"
          || response.error.code === "INTERNAL_ERROR";
        if (response.error.code === "UPLOAD_INCOMPLETE") transferCompletedRef.current = false;
        setStage("failed"); setError(translateError(response.error.code));
        if (!retryable) clearAttempt();
        return;
      }
      setStage("success");
      clearAttempt();
      onSuccess(response.data);
    } catch (caught) {
      if (!mountedRef.current) return;
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setStage("failed"); setError(translateError("UPLOAD_INCOMPLETE"));
    }
  }, [clearAttempt, onSuccess, translateError]);

  const submit = useCallback(async (values: ConversationUploadSchema) => {
    setStage("preparing"); setError(null); setSelectedFile(values.file);
    try {
      const declaredMimeType = normalizeConversationMimeType(values.file, policy.permittedMimeTypes);
      const intent = JSON.stringify([
        sourceType,
        values.locale,
        values.file.name,
        values.file.size,
        declaredMimeType,
        values.file.lastModified,
      ]);
      if (prepareAttemptRef.current?.intent !== intent) {
        prepareAttemptRef.current = { intent, idempotencyKey: crypto.randomUUID() };
        transferCompletedRef.current = false;
      }
      const prepareAction = sourceType === "microphone"
        ? prepareConversationRecordingAction
        : prepareConversationUploadAction;
      const response = await prepareAction({
        idempotencyKey: prepareAttemptRef.current.idempotencyKey, locale: values.locale,
        originalFilename: values.file.name,
        declaredMimeType,
        declaredByteSize: values.file.size,
      });
      if (!mountedRef.current) return;
      if (!response.success) {
        if (response.error.code !== "INTERNAL_ERROR") prepareAttemptRef.current = null;
        setStage("failed"); setError(translateError(response.error.code)); return;
      }
      setPrepared(response.data);
      await transferAndComplete(response.data, values.file);
    } catch { if (mountedRef.current) { setStage("failed"); setError(translateError("INTERNAL_ERROR")); } }
  }, [policy.permittedMimeTypes, sourceType, transferAndComplete, translateError]);

  const cancel = useCallback(async () => {
    abortActiveUpload();
    return discard();
  }, [abortActiveUpload, discard]);
  const retry = useCallback(async () => {
    if (prepared && selectedFile) await transferAndComplete(prepared, selectedFile);
  }, [prepared, selectedFile, transferAndComplete]);
  const reset = useCallback(() => { setError(null); setStage("idle"); setProgress(0); clearAttempt(); }, [clearAttempt]);
  return { submit, cancel, retry, reset, stage, progress, error, locked,
    canCancel: stage === "uploading" || (stage === "failed" && Boolean(prepared)),
    canRetry: stage === "failed" && Boolean(prepared && selectedFile) };
}
