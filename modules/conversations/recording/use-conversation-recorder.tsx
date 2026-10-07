"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationUploadPolicy } from "../lib/types/conversation.types";

export type ConversationRecordingStage =
  | "idle"
  | "requesting"
  | "recording"
  | "stopping"
  | "review"
  | "failed";

export type ConversationRecordingError =
  | "unsupportedBrowser"
  | "permissionDenied"
  | "deviceNotFound"
  | "deviceUnavailable"
  | "captureFailed"
  | "emptyRecording"
  | "recordingTooLarge";

export type ConversationRecordingNotice = "limitReached" | "interrupted";

type StopReason = "user" | "limit" | "interrupted";

const RECORDING_TIMESLICE_MS = 1_000;
const TIMER_REFRESH_MS = 250;
const AUDIO_BITS_PER_SECOND = 128_000;

export function getSupportedRecordingMimeType(): string | null {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return null;
  }
  for (const mimeType of ["audio/webm;codecs=opus", "audio/webm"]) {
    if (MediaRecorder.isTypeSupported(mimeType)) return mimeType;
  }
  return null;
}

function recordingError(error: unknown): ConversationRecordingError {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "permissionDenied";
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") return "deviceNotFound";
    if (error.name === "NotReadableError" || error.name === "AbortError") return "deviceUnavailable";
  }
  return "captureFailed";
}

export default function useConversationRecorder(policy: ConversationUploadPolicy) {
  const [stage, setStage] = useState<ConversationRecordingStage>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activity, setActivity] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<ConversationRecordingError | null>(null);
  const [notice, setNotice] = useState<ConversationRecordingNotice | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const stopReasonRef = useRef<StopReason>("user");
  const previewUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    if (mountedRef.current) setPreviewUrl(null);
  }, []);

  const clearCaptureTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (limitTimeoutRef.current) clearTimeout(limitTimeoutRef.current);
    if (animationFrameRef.current != null) cancelAnimationFrame(animationFrameRef.current);
    intervalRef.current = null;
    limitTimeoutRef.current = null;
    animationFrameRef.current = null;
  }, []);

  const releaseMedia = useCallback(() => {
    clearCaptureTimers();
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.onended = null;
      track.stop();
    }
    streamRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    recorderRef.current = null;
    if (mountedRef.current) setActivity(0);
  }, [clearCaptureTimers]);

  const finalizeRecording = useCallback(() => {
    const durationMs = Math.max(0, Date.now() - startedAtRef.current);
    const reason = stopReasonRef.current;
    const chunks = chunksRef.current;
    chunksRef.current = [];
    releaseMedia();
    if (!mountedRef.current) return;
    setElapsedMs(Math.min(durationMs, policy.maximumDurationMs));

    const blob = new Blob(chunks, { type: "audio/webm" });
    if (blob.size < 1) {
      setFile(null);
      setStage("failed");
      setError(reason === "interrupted" ? "captureFailed" : "emptyRecording");
      return;
    }
    if (blob.size > policy.maximumBytes) {
      setFile(null);
      setStage("failed");
      setError("recordingTooLarge");
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const recordedFile = new File([blob], `conversation-${timestamp}.webm`, {
      type: "audio/webm",
      lastModified: Date.now(),
    });
    revokePreview();
    const nextPreviewUrl = URL.createObjectURL(recordedFile);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setFile(recordedFile);
    setNotice(reason === "limit" ? "limitReached" : reason === "interrupted" ? "interrupted" : null);
    setError(null);
    setStage("review");
  }, [policy.maximumBytes, policy.maximumDurationMs, releaseMedia, revokePreview]);

  const stop = useCallback((reason: StopReason = "user") => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    stopReasonRef.current = reason;
    if (mountedRef.current) setStage("stopping");
    try {
      recorder.stop();
    } catch {
      releaseMedia();
      if (mountedRef.current) {
        setStage("failed");
        setError("captureFailed");
      }
    }
  }, [releaseMedia]);

  const startActivityMeter = useCallback((stream: MediaStream) => {
    const AudioContextApi = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextApi) return;
    try {
      const context = new AudioContextApi();
      void context.resume().catch(() => undefined);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      audioContextRef.current = context;
      const update = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          sum += normalized * normalized;
        }
        if (mountedRef.current) setActivity(Math.min(100, Math.round(Math.sqrt(sum / samples.length) * 240)));
        animationFrameRef.current = requestAnimationFrame(update);
      };
      update();
    } catch {
      audioContextRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setNotice(null);
    revokePreview();
    setFile(null);
    setElapsedMs(0);
    chunksRef.current = [];

    const mimeType = getSupportedRecordingMimeType();
    if (!navigator.mediaDevices?.getUserMedia || !mimeType || !policy.permittedMimeTypes.includes("audio/webm")) {
      setStage("failed");
      setError("unsupportedBrowser");
      return;
    }

    setStage("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: AUDIO_BITS_PER_SECOND });
      streamRef.current = stream;
      recorderRef.current = recorder;
      stopReasonRef.current = "user";
      startedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = finalizeRecording;
      recorder.onerror = () => stop("interrupted");
      for (const track of stream.getAudioTracks()) track.onended = () => stop("interrupted");
      recorder.start(RECORDING_TIMESLICE_MS);
      startActivityMeter(stream);
      intervalRef.current = setInterval(() => {
        if (mountedRef.current) setElapsedMs(Math.min(Date.now() - startedAtRef.current, policy.maximumDurationMs));
      }, TIMER_REFRESH_MS);
      limitTimeoutRef.current = setTimeout(() => stop("limit"), policy.maximumDurationMs);
      setStage("recording");
    } catch (caught) {
      releaseMedia();
      if (mountedRef.current) {
        setStage("failed");
        setError(recordingError(caught));
      }
    }
  }, [finalizeRecording, policy.maximumDurationMs, policy.permittedMimeTypes, releaseMedia, revokePreview, startActivityMeter, stop]);

  const discard = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      try { recorder.stop(); } catch { /* already stopping */ }
    }
    releaseMedia();
    revokePreview();
    chunksRef.current = [];
    setFile(null);
    setElapsedMs(0);
    setActivity(0);
    setError(null);
    setNotice(null);
    setStage("idle");
  }, [releaseMedia, revokePreview]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        try { recorder.stop(); } catch { /* already stopping */ }
      }
      releaseMedia();
      revokePreview();
    };
  }, [releaseMedia, revokePreview]);

  return {
    stage,
    elapsedMs,
    activity,
    file,
    previewUrl,
    error,
    notice,
    start,
    stop: () => stop("user"),
    discard,
    locked: stage === "requesting" || stage === "recording" || stage === "stopping",
    hasUnsavedRecording: Boolean(file),
  };
}
