import "server-only";

const DEFAULT_MAXIMUM_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAXIMUM_DURATION_MS = 10 * 60 * 1000;
const DEFAULT_UPLOAD_GRANT_SECONDS = 15 * 60;

function positiveInteger(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}.`);
  }
  return value;
}

export const conversationAudioConfig = Object.freeze({
  maximumBytes: positiveInteger(
    "CONVERSATION_AUDIO_MAX_BYTES",
    DEFAULT_MAXIMUM_BYTES,
    100 * 1024 * 1024,
  ),
  maximumDurationMs: positiveInteger(
    "CONVERSATION_AUDIO_MAX_DURATION_MS",
    DEFAULT_MAXIMUM_DURATION_MS,
    60 * 60 * 1000,
  ),
  uploadGrantSeconds: positiveInteger(
    "CONVERSATION_UPLOAD_GRANT_SECONDS",
    DEFAULT_UPLOAD_GRANT_SECONDS,
    60 * 60,
  ),
});

export const permittedConversationMimeTypes = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "video/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/vnd.wave",
  "audio/ogg",
  "application/ogg",
  "audio/webm",
  "video/webm",
  "application/octet-stream",
] as const;

export const permittedConversationExtensions = [
  ".webm", ".weba", ".mp3", ".mpeg", ".m4a", ".mp4", ".wav", ".ogg", ".oga",
] as const;
