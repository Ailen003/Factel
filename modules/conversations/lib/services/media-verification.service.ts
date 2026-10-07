import "server-only";

import { parseBuffer } from "music-metadata";
import { readWebmDurationMs } from "./webm-duration.service";

export interface VerifiedConversationMedia {
  container: string;
  durationMs: number;
  mimeType: string;
}

export type MediaVerificationResult =
  | { success: true; data: VerifiedConversationMedia }
  | {
      success: false;
      code: "MEDIA_TOO_LONG" | "UNSUPPORTED_MEDIA" | "MEDIA_VERIFICATION_FAILED";
    };

function detectedMimeType(container: string): string | null {
  const value = container.toLowerCase();
  if (value.includes("mpeg") || value.includes("mp3")) return "audio/mpeg";
  if (value.includes("m4a") || value.includes("mp4") || value.includes("isom")) return "audio/mp4";
  if (value.includes("wave") || value.includes("wav")) return "audio/wav";
  if (value.includes("ogg")) return "audio/ogg";
  if (value.includes("webm")) return "audio/webm";
  return null;
}

export async function verifyConversationMedia(
  bytes: Uint8Array,
  maximumDurationMs: number,
): Promise<MediaVerificationResult> {
  try {
    const metadata = await parseBuffer(bytes, undefined, {
      duration: true,
      skipCovers: true,
    });
    const { format } = metadata;
    const container = format.container?.trim();
    const mimeType = container ? detectedMimeType(container) : null;
    const metadataDurationMs = Math.round((format.duration ?? 0) * 1000);
    const hasAudio =
      format.hasAudio === true ||
      (format.numberOfChannels ?? 0) > 0 ||
      Boolean(format.codec);

    if (!container || !mimeType || !hasAudio || format.hasVideo === true) {
      return { success: false, code: "UNSUPPORTED_MEDIA" };
    }
    const durationMs = metadataDurationMs > 0
      ? metadataDurationMs
      : mimeType === "audio/webm"
        ? readWebmDurationMs(bytes)
        : null;
    if (durationMs == null || durationMs <= 0) {
      return { success: false, code: "MEDIA_VERIFICATION_FAILED" };
    }
    if (!Number.isSafeInteger(durationMs)) {
      return { success: false, code: "MEDIA_VERIFICATION_FAILED" };
    }
    if (durationMs > maximumDurationMs) {
      return { success: false, code: "MEDIA_TOO_LONG" };
    }
    return { success: true, data: { container, durationMs, mimeType } };
  } catch {
    return { success: false, code: "MEDIA_VERIFICATION_FAILED" };
  }
}
