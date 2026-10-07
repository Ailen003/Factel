import { z } from "zod";

export const conversationSourceTypes = ["upload", "microphone"] as const;
export type ConversationSourceType = (typeof conversationSourceTypes)[number];
export const conversationLocales = ["en", "es"] as const;
export type ConversationLocale = (typeof conversationLocales)[number];
export const conversationStatuses = [
  "draft", "audio_ready", "queued", "transcribing", "diarizing", "transcribed", "extracting",
  "validating", "needs_review", "ready", "record_plan_pending", "completed",
  "failed", "quota_blocked", "cancelled",
] as const;
export type ConversationStatus = (typeof conversationStatuses)[number];

export interface ConversationSummary {
  id: string;
  sourceType: ConversationSourceType;
  locale: ConversationLocale;
  status: ConversationStatus;
  version: number;
  durationMs: number | null;
  originalFilename: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetails extends ConversationSummary {
  audio: null | {
    verificationState: "pending" | "uploaded" | "verified" | "rejected";
    verifiedMimeType: string | null;
    verifiedContainer: string | null;
    byteSize: number | null;
    checksumAlgorithm: string | null;
    checksum: string | null;
    playbackPath: string | null;
  };
  credits: {
    available: number;
    reserved: number;
    consumed: number;
  };
  processingRun: null | {
    id: string;
    status: "accepted" | "running" | "succeeded" | "failed" | "cancelled" | "quota_blocked";
    stage: "queued" | "transcribing" | "diarizing" | "extracting" | "validating" | "publishing";
    retryable: boolean;
    failureCode: string | null;
  };
  transcript: null | {
    text: string;
    locale: ConversationLocale;
    completedAt: string;
    diarizationStatus: "pending" | "available" | "unavailable" | "failed";
    warningCode: string | null;
    segments: Array<{
      id: string;
      startMs: number | null;
      endMs: number | null;
      startOffset: number;
      endOffset: number;
      text: string;
      speakerId: string | null;
      confidence: number | null;
    }>;
  };
}

export interface ConversationFiltersDto {
  page: number;
  limit: 5 | 10 | 20 | 30;
  sourceType?: ConversationSourceType;
  locale?: ConversationLocale;
  status?: ConversationStatus;
  sortBy: "createdAt" | "updatedAt";
  sortOrder: "asc" | "desc";
}

export interface ConversationsResponse {
  conversations: ConversationSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ConversationUploadPolicy {
  maximumBytes: number;
  maximumDurationMs: number;
  grantExpiresInSeconds: number;
  permittedMimeTypes: string[];
}

export interface PreparedConversationUpload {
  conversationId: string;
  grantId: string;
  version: number;
  uploadUrl: string;
  expiresAt: string;
  requiredContentType: string;
  policy: ConversationUploadPolicy;
}

export interface ConversationMutationResult {
  conversationId: string;
  version: number;
}

export const conversationFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().pipe(z.union([z.literal(5), z.literal(10), z.literal(20), z.literal(30)])).default(10),
  sourceType: z.enum(conversationSourceTypes).optional(),
  locale: z.enum(conversationLocales).optional(),
  status: z.enum(conversationStatuses).optional(),
  sortBy: z.enum(["createdAt", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict();

type FilterSource = URLSearchParams | Record<string, string | string[] | undefined>;
export function parseConversationFilters(source: FilterSource): ConversationFiltersDto {
  const read = (key: string) => {
    if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
    const value = source[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const parsed = conversationFiltersSchema.safeParse({
    page: read("page"), limit: read("limit"), sourceType: read("sourceType"),
    locale: read("locale"), status: read("status"), sortBy: read("sortBy"),
    sortOrder: read("sortOrder"),
  });
  return parsed.success
    ? parsed.data
    : { page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" };
}

export const conversationIdSchema = z.string().trim().min(1).max(191);
export const prepareConversationUploadSchema = z.object({
  locale: z.enum(conversationLocales),
  originalFilename: z.string().trim().min(1).max(255),
  declaredMimeType: z.string().trim().min(1).max(127),
  declaredByteSize: z.number().int().positive().max(100 * 1024 * 1024),
  idempotencyKey: z.string().uuid(),
}).strict();
export type PrepareConversationUploadInput = z.infer<typeof prepareConversationUploadSchema>;

export const completeConversationUploadSchema = z.object({
  conversationId: conversationIdSchema,
  grantId: conversationIdSchema,
}).strict();
export type CompleteConversationUploadInput = z.infer<typeof completeConversationUploadSchema>;

export const discardConversationUploadSchema = z.object({
  conversationId: conversationIdSchema,
  grantId: conversationIdSchema,
  expectedVersion: z.number().int().positive(),
}).strict();
export type DiscardConversationUploadInput = z.infer<typeof discardConversationUploadSchema>;

export const deleteConversationSchema = z.object({
  id: conversationIdSchema,
  expectedVersion: z.number().int().positive(),
}).strict();
export type DeleteConversationInput = z.infer<typeof deleteConversationSchema>;

export const startConversationProcessingSchema = z.object({
  conversationId: conversationIdSchema,
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
}).strict();
export type StartConversationProcessingInput = z.infer<typeof startConversationProcessingSchema>;
export const continueConversationExtractionSchema = startConversationProcessingSchema.omit({ idempotencyKey: true });
export type ContinueConversationExtractionInput = z.infer<typeof continueConversationExtractionSchema>;

export interface ProcessingStartResult {
  processingRunId: string;
  conversationId: string;
  version: number;
}
