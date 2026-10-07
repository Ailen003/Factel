import { z } from "zod";

export interface ConversationUploadValidationMessages {
  fileRequired: string;
  fileTooLarge: string;
  unsupportedFile: string;
  localeRequired: string;
}

const EXTENSION_MIME: Record<string, string> = {
  mp3: "audio/mpeg", mpeg: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4", wav: "audio/wav",
  ogg: "audio/ogg", oga: "audio/ogg", webm: "audio/webm", weba: "audio/webm",
};
const MIME_ALIASES: Record<string, string> = {
  "audio/x-m4a": "audio/mp4", "video/mp4": "audio/mp4", "audio/wave": "audio/wav",
  "audio/vnd.wave": "audio/wav", "application/ogg": "audio/ogg", "audio/x-mpeg": "audio/mpeg",
};

function extension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function normalizeConversationMimeType(file: File, permittedMimeTypes: string[]) {
  const declared = MIME_ALIASES[file.type] ?? file.type;
  if (permittedMimeTypes.includes(declared)) return declared;
  const inferred = EXTENSION_MIME[extension(file.name)];
  return inferred && permittedMimeTypes.includes(inferred) ? inferred : "application/octet-stream";
}

export function conversationAudioAccept(permittedMimeTypes: string[]): Record<string, string[]> {
  const extensionsByMime: Record<string, string[]> = {
    "audio/mpeg": [".mp3", ".mpeg"], "audio/mp4": [".m4a", ".mp4"], "audio/wav": [".wav"],
    "audio/x-wav": [".wav"], "audio/ogg": [".ogg", ".oga"], "audio/webm": [".webm", ".weba"],
  };
  return Object.fromEntries(permittedMimeTypes.map((mime) => [mime, extensionsByMime[mime] ?? []]));
}

export function conversationUploadSchemaFactory(messages: ConversationUploadValidationMessages, maximumBytes: number, permittedMimeTypes: string[]) {
  const acceptedMimeTypes = new Set(permittedMimeTypes);
  return z.object({
    file: z.custom<File>((value) => typeof File !== "undefined" && value instanceof File, messages.fileRequired)
      .refine((file) => typeof File === "undefined" || !(file instanceof File) || file.size <= maximumBytes, messages.fileTooLarge)
      .refine((file) => typeof File === "undefined" || !(file instanceof File)
        || acceptedMimeTypes.has(normalizeConversationMimeType(file, permittedMimeTypes)), messages.unsupportedFile),
    locale: z.enum(["en", "es"], { message: messages.localeRequired }),
  });
}

export type ConversationUploadSchema = z.infer<ReturnType<typeof conversationUploadSchemaFactory>>;
