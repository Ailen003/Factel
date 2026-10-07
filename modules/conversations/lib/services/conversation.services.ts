import "server-only";

import { deleteConversationProposals } from "./proposal-cleanup.services";

import { createHash, randomUUID } from "node:crypto";
import {
  Prisma,
  type ConversationStatus as PrismaConversationStatus,
} from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { resolveCurrentWorkspace } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/types";
import type { ServiceResponse } from "@/lib/api-responses";
import { assertRecordAccess, isRetryableRecordConflict } from "@/lib/records/record-policy";
import {
  copyObject,
  createSignedUploadUrlForKey,
  deleteObject,
  headObject,
  readObjectBytes,
} from "@/lib/storage/storage.service";
import {
  conversationAudioConfig,
  permittedConversationExtensions,
  permittedConversationMimeTypes,
} from "../config/conversation-audio.config";
import {
  completeConversationUploadSchema,
  conversationFiltersSchema,
  conversationIdSchema,
  deleteConversationSchema,
  discardConversationUploadSchema,
  prepareConversationUploadSchema,
  type CompleteConversationUploadInput,
  type ConversationDetails,
  type ConversationFiltersDto,
  type ConversationMutationResult,
  type ConversationSourceType,
  type ConversationsResponse,
  type ConversationSummary,
  type DeleteConversationInput,
  type DiscardConversationUploadInput,
  type PreparedConversationUpload,
  type PrepareConversationUploadInput,
} from "../types/conversation.types";
import { verifyConversationMedia } from "./media-verification.service";
import { getWorkspaceCreditBalance, initializeWorkspaceCredits, type CreditBalance } from "./credit.services";

const activeConversationWhere = { deletionState: "ACTIVE" as const };
const cleanupBatchSize = 20;
const cleanupLeaseMs = 5 * 60 * 1000;
const maximumCleanupBackoffMs = 60 * 60 * 1000;

class ConversationServiceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ConversationServiceError";
  }
}

function failure(code: string, details?: Record<string, unknown>): ServiceResponse<never> {
  return { success: false, error: { code, message: code, ...(details ? { details } : {}) } };
}

function serviceError(error: unknown): ServiceResponse<never> {
  if (error instanceof AuthError || error instanceof ConversationServiceError) {
    return failure(error.code);
  }
  console.error("Conversation operation failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return failure("INTERNAL_ERROR");
}

function isNotFoundStorageError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "$metadata" in error &&
    (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
  );
}

const summarySelect = {
  id: true,
  sourceType: true,
  locale: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  audioArtifact: {
    select: { durationMs: true, originalFilename: true },
  },
} satisfies Prisma.ConversationSelect;
type SelectedSummary = Prisma.ConversationGetPayload<{ select: typeof summarySelect }>;

function mapSummary(row: SelectedSummary): ConversationSummary {
  return {
    id: row.id,
    sourceType: row.sourceType.toLowerCase() as ConversationSummary["sourceType"],
    locale: row.locale,
    status: row.status.toLowerCase() as ConversationSummary["status"],
    version: row.version,
    durationMs: row.audioArtifact?.durationMs ?? null,
    originalFilename: row.audioArtifact?.originalFilename ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const detailsSelect = {
  ...summarySelect,
  audioArtifact: {
    select: {
      durationMs: true,
      originalFilename: true,
      verifiedMimeType: true,
      verifiedContainer: true,
      byteSize: true,
      checksumAlgorithm: true,
      checksum: true,
      verificationState: true,
      deletionState: true,
    },
  },
  currentRun: {
    select: { id: true, status: true, stage: true, retryable: true, terminalReason: true },
  },
  originalTranscript: {
    select: {
      text: true,
      language: true,
      finalizedAt: true,
      evidence: {
        select: {
          stableEvidenceId: true,
          startOffset: true,
          endOffset: true,
          startMs: true,
          endMs: true,
          speakerSegments: {
            select: { speakerLabel: true, confidence: true },
            take: 1,
          },
        },
        orderBy: [{ startOffset: "asc" }, { stableEvidenceId: "asc" }],
      },
    },
  },
  diarizationVersions: {
    select: { version: true, status: true, warnings: true },
    orderBy: { version: "desc" },
    take: 1,
  },
} satisfies Prisma.ConversationSelect;
type SelectedDetails = Prisma.ConversationGetPayload<{ select: typeof detailsSelect }>;

function safeBigInt(value: bigint | null): number | null {
  if (value === null) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function mapDetails(row: SelectedDetails, credits: CreditBalance): ConversationDetails {
  const summary = mapSummary(row);
  const artifact = row.audioArtifact;
  return {
    ...summary,
    credits,
    processingRun: row.currentRun
      ? {
          id: row.currentRun.id,
          status: row.currentRun.status.toLowerCase() as NonNullable<ConversationDetails["processingRun"]>["status"],
          stage: row.currentRun.stage.toLowerCase() as NonNullable<ConversationDetails["processingRun"]>["stage"],
          retryable: row.currentRun.retryable,
          failureCode: row.currentRun.terminalReason,
        }
      : null,
    transcript: row.originalTranscript
      ? {
          text: row.originalTranscript.text,
          locale: row.originalTranscript.language,
          completedAt: row.originalTranscript.finalizedAt.toISOString(),
          diarizationStatus: (row.diarizationVersions[0]?.status ?? "UNAVAILABLE").toLowerCase() as NonNullable<ConversationDetails["transcript"]>["diarizationStatus"],
          warningCode: (() => {
            const warnings = row.diarizationVersions[0]?.warnings;
            return typeof warnings === "object" && warnings !== null && !Array.isArray(warnings)
              && typeof (warnings as Record<string, unknown>).code === "string"
              ? (warnings as Record<string, string>).code
              : null;
          })(),
          segments: row.originalTranscript.evidence.map((evidence) => ({
            id: evidence.stableEvidenceId,
            startMs: evidence.startMs,
            endMs: evidence.endMs,
            startOffset: evidence.startOffset,
            endOffset: evidence.endOffset,
            text: row.originalTranscript!.text.slice(evidence.startOffset, evidence.endOffset),
            speakerId: evidence.speakerSegments[0]?.speakerLabel ?? null,
            confidence: evidence.speakerSegments[0]?.confidence
              ? Number(evidence.speakerSegments[0].confidence)
              : null,
          })),
        }
      : null,
    audio:
      artifact && artifact.deletionState === "ACTIVE"
        ? {
            verificationState: artifact.verificationState.toLowerCase() as NonNullable<ConversationDetails["audio"]>["verificationState"],
            verifiedMimeType: artifact.verifiedMimeType,
            verifiedContainer: artifact.verifiedContainer,
            byteSize: safeBigInt(artifact.byteSize),
            checksumAlgorithm: artifact.checksumAlgorithm,
            checksum: artifact.checksum,
            playbackPath:
              artifact.verificationState === "VERIFIED"
                ? `/api/conversations/${encodeURIComponent(row.id)}/audio`
                : null,
          }
        : null,
  };
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    actorUserId?: string;
    conversationId: string;
    action: string;
    outcome: "SUCCEEDED" | "DENIED" | "FAILED";
    reason?: string;
    correlationId: string;
  },
) {
  await tx.auditEvent.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      resourceType: "conversation",
      resourceId: input.conversationId,
      action: input.action,
      outcome: input.outcome,
      correlationId: input.correlationId,
      safeMetadata: input.reason ? { reason: input.reason } : undefined,
    },
  });
}

export async function getConversations(
  filters: ConversationFiltersDto,
): Promise<ServiceResponse<ConversationsResponse>> {
  const parsed = conversationFiltersSchema.safeParse(filters);
  if (!parsed.success) return failure("VALIDATION_ERROR");
  const input = parsed.data;
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    const where: Prisma.ConversationWhereInput = {
      workspaceId: workspace.id,
      ...activeConversationWhere,
      ...(input.sourceType ? { sourceType: input.sourceType.toUpperCase() as "UPLOAD" | "MICROPHONE" } : {}),
      ...(input.locale ? { locale: input.locale } : {}),
      ...(input.status ? { status: input.status.toUpperCase() as PrismaConversationStatus } : {}),
    };
    return await prisma.$transaction(
      async (tx) => {
        await assertRecordAccess(tx, session, workspace.id);
        const total = await tx.conversation.count({ where });
        const totalPages = Math.max(1, Math.ceil(total / input.limit));
        const page = Math.min(input.page, totalPages);
        const rows = await tx.conversation.findMany({
          where,
          select: summarySelect,
          orderBy: [{ [input.sortBy]: input.sortOrder }, { id: "asc" }],
          skip: (page - 1) * input.limit,
          take: input.limit,
        });
        return {
          success: true as const,
          data: {
            conversations: rows.map(mapSummary),
            pagination: { page, limit: input.limit, total, totalPages },
          },
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  } catch (error) {
    return serviceError(error);
  }
}

export async function getConversationById(id: string): Promise<ServiceResponse<ConversationDetails>> {
  const parsed = conversationIdSchema.safeParse(id);
  if (!parsed.success) return failure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    return await prisma.$transaction(
      async (tx) => {
        await assertRecordAccess(tx, session, workspace.id);
        const row = await tx.conversation.findFirst({
          where: { id: parsed.data, workspaceId: workspace.id, ...activeConversationWhere },
          select: detailsSelect,
        });
        if (!row) return failure("NOT_FOUND");
        await initializeWorkspaceCredits(tx, workspace.id);
        const credits = await getWorkspaceCreditBalance(tx, workspace.id);
        return { success: true as const, data: mapDetails(row, credits) };
      },
      { isolationLevel: "RepeatableRead" },
    );
  } catch (error) {
    return serviceError(error);
  }
}

function uploadPolicy() {
  return {
    maximumBytes: conversationAudioConfig.maximumBytes,
    maximumDurationMs: conversationAudioConfig.maximumDurationMs,
    grantExpiresInSeconds: conversationAudioConfig.uploadGrantSeconds,
    permittedMimeTypes: [...permittedConversationMimeTypes],
  };
}

export async function getConversationUploadPolicy(): Promise<ServiceResponse<ReturnType<typeof uploadPolicy>>> {
  try {
    await resolveCurrentWorkspace();
    return { success: true, data: uploadPolicy() };
  } catch (error) {
    return serviceError(error);
  }
}

async function prepareConversationAudio(
  input: PrepareConversationUploadInput,
  sourceType: ConversationSourceType,
): Promise<ServiceResponse<PreparedConversationUpload>> {
  const parsed = prepareConversationUploadSchema.safeParse(input);
  if (!parsed.success) return failure("VALIDATION_ERROR");
  const declaredMimeType = parsed.data.declaredMimeType.toLowerCase();
  const extension = parsed.data.originalFilename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  if (
    !permittedConversationMimeTypes.includes(
      declaredMimeType as (typeof permittedConversationMimeTypes)[number],
    )
  ) {
    return failure("UNSUPPORTED_MEDIA");
  }
  if (
    declaredMimeType === "application/octet-stream" &&
    !permittedConversationExtensions.includes(
      extension as (typeof permittedConversationExtensions)[number],
    )
  ) return failure("UNSUPPORTED_MEDIA");
  if (parsed.data.declaredByteSize > conversationAudioConfig.maximumBytes) {
    return failure("MEDIA_TOO_LARGE");
  }
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    const idempotencyKey = `${workspace.id}:${parsed.data.idempotencyKey}`;
    let prepared:
      | {
          conversationId: string;
          grantId: string;
          stagingStorageKey: string;
          expiresAt: Date;
          version: number;
          status: "ISSUED" | "COMPLETED" | "CONSUMED" | "EXPIRED" | "REVOKED";
        }
      | undefined;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        prepared = await prisma.$transaction(
          async (tx) => {
            await assertRecordAccess(tx, session, workspace.id);
            const existing = await tx.uploadGrant.findUnique({
              where: { idempotencyKey },
              select: {
                id: true,
                workspaceId: true,
                conversationId: true,
                stagingStorageKey: true,
                declaredMimeType: true,
                declaredByteSize: true,
                expiresAt: true,
                status: true,
                conversation: { select: { locale: true, sourceType: true, version: true } },
                expectedArtifact: { select: { originalFilename: true } },
              },
            });
            if (existing) {
              if (existing.workspaceId !== workspace.id) throw new AuthError("UNAUTHENTICATED");
              const sameIntent =
                existing.conversation.sourceType === sourceType.toUpperCase() &&
                existing.conversation.locale === parsed.data.locale &&
                existing.expectedArtifact.originalFilename === parsed.data.originalFilename &&
                existing.declaredMimeType === declaredMimeType &&
                existing.declaredByteSize === BigInt(parsed.data.declaredByteSize);
              if (!sameIntent) throw new ConversationServiceError("IDEMPOTENCY_CONFLICT");
              return {
                conversationId: existing.conversationId,
                grantId: existing.id,
                stagingStorageKey: existing.stagingStorageKey,
                expiresAt: existing.expiresAt,
                version: existing.conversation.version,
                status: existing.status,
              };
            }

            const conversationId = randomUUID();
            const artifactId = randomUUID();
            const grantId = randomUUID();
            const correlationId = randomUUID();
            const stagingStorageKey = `conversation-staging/${workspace.id}/${grantId}`;
            const finalStorageKey = `conversations/${workspace.id}/${conversationId}/${artifactId}`;
            const expiresAt = new Date(Date.now() + conversationAudioConfig.uploadGrantSeconds * 1000);
            await tx.conversation.create({
              data: {
                id: conversationId,
                workspaceId: workspace.id,
                sourceType: sourceType.toUpperCase() as "UPLOAD" | "MICROPHONE",
                locale: parsed.data.locale,
                correlationId,
              },
            });
            await tx.audioArtifact.create({
              data: {
                id: artifactId,
                workspaceId: workspace.id,
                conversationId,
                storageKey: finalStorageKey,
                originalFilename: parsed.data.originalFilename,
              },
            });
            await tx.uploadGrant.create({
              data: {
                id: grantId,
                workspaceId: workspace.id,
                conversationId,
                expectedArtifactId: artifactId,
                stagingStorageKey,
                declaredMimeType,
                declaredByteSize: BigInt(parsed.data.declaredByteSize),
                permittedMimeTypes: [...permittedConversationMimeTypes],
                maximumBytes: BigInt(conversationAudioConfig.maximumBytes),
                expiresAt,
                idempotencyKey,
              },
            });
            await writeAudit(tx, {
              workspaceId: workspace.id,
              actorUserId: session.user.id,
              conversationId,
              action: sourceType === "microphone"
                ? "conversation.recording.prepare"
                : "conversation.upload.prepare",
              outcome: "SUCCEEDED",
              correlationId,
            });
            return {
              conversationId,
              grantId,
              stagingStorageKey,
              expiresAt,
              version: 1,
              status: "ISSUED" as const,
            };
          },
          { isolationLevel: "Serializable" },
        );
        break;
      } catch (error) {
        if (isRetryableRecordConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    if (!prepared) return failure("INTERNAL_ERROR");
    if (prepared.status === "CONSUMED") return failure("INVALID_STATUS_TRANSITION");
    if (prepared.status === "EXPIRED" || prepared.status === "REVOKED" || prepared.expiresAt <= new Date()) {
      return failure("UPLOAD_EXPIRED");
    }
    const expiresIn = Math.max(1, Math.floor((prepared.expiresAt.getTime() - Date.now()) / 1000));
    const signed = await createSignedUploadUrlForKey(
      {
        key: prepared.stagingStorageKey,
        contentType: declaredMimeType,
      },
      expiresIn,
    );
    return {
      success: true,
      data: {
        conversationId: prepared.conversationId,
        grantId: prepared.grantId,
        version: prepared.version,
        uploadUrl: signed.url,
        expiresAt: prepared.expiresAt.toISOString(),
        requiredContentType: declaredMimeType,
        policy: uploadPolicy(),
      },
    };
  } catch (error) {
    return serviceError(error);
  }
}

export function prepareConversationUpload(
  input: PrepareConversationUploadInput,
): Promise<ServiceResponse<PreparedConversationUpload>> {
  return prepareConversationAudio(input, "upload");
}

export function prepareConversationRecording(
  input: PrepareConversationUploadInput,
): Promise<ServiceResponse<PreparedConversationUpload>> {
  return prepareConversationAudio(input, "microphone");
}

async function rejectUploadedConversation(
  workspaceId: string,
  conversationId: string,
  grantId: string,
  code: string,
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const grant = await tx.uploadGrant.findFirst({
        where: { id: grantId, conversationId, workspaceId },
        select: {
          id: true,
          stagingStorageKey: true,
          expectedArtifactId: true,
          conversation: { select: { correlationId: true, deletionState: true, sourceType: true } },
        },
      });
      if (!grant || grant.conversation.deletionState !== "ACTIVE") return;
      await tx.uploadGrant.updateMany({
        where: { id: grant.id, workspaceId, status: { in: ["ISSUED", "COMPLETED"] } },
        data: { status: "REVOKED" },
      });
      await tx.audioArtifact.updateMany({
        where: { id: grant.expectedArtifactId, workspaceId },
        data: { verificationState: "REJECTED", deletionState: "DELETE_REQUESTED" },
      });
      await tx.conversation.updateMany({
        where: { id: conversationId, workspaceId, deletionState: "ACTIVE" },
        data: { deletionState: "DELETE_REQUESTED", version: { increment: 1 } },
      });
      await tx.cleanupTask.upsert({
        where: {
          resourceType_resourceId_deletionIntent: {
            resourceType: "conversation_audio",
            resourceId: conversationId,
            deletionIntent: `delete-staging:${grant.id}`,
          },
        },
        create: {
          workspaceId,
          resourceType: "conversation_audio",
          resourceId: conversationId,
          storageKey: grant.stagingStorageKey,
          deletionIntent: `delete-staging:${grant.id}`,
          correlationId: grant.conversation.correlationId,
        },
        update: {},
      });
      await writeAudit(tx, {
        workspaceId,
        conversationId,
        action: grant.conversation.sourceType === "MICROPHONE"
          ? "conversation.recording.verify"
          : "conversation.upload.verify",
        outcome: "DENIED",
        reason: code,
        correlationId: grant.conversation.correlationId,
      });
    },
    { isolationLevel: "Serializable" },
  );
}

export async function completeConversationUpload(
  input: CompleteConversationUploadInput,
): Promise<ServiceResponse<ConversationMutationResult>> {
  const parsed = completeConversationUploadSchema.safeParse(input);
  if (!parsed.success) return failure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    const grant = await prisma.$transaction(
      async (tx) => {
        await assertRecordAccess(tx, session, workspace.id);
        return tx.uploadGrant.findFirst({
          where: {
            id: parsed.data.grantId,
            conversationId: parsed.data.conversationId,
            workspaceId: workspace.id,
          },
          select: {
            id: true,
            status: true,
            expiresAt: true,
            maximumBytes: true,
            declaredByteSize: true,
            declaredMimeType: true,
            stagingStorageKey: true,
            expectedArtifact: {
              select: { id: true, storageKey: true, verificationState: true },
            },
            conversation: {
              select: { status: true, deletionState: true, version: true },
            },
          },
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
    if (!grant || grant.conversation.deletionState !== "ACTIVE") return failure("NOT_FOUND");
    if (
      grant.status === "CONSUMED" &&
      grant.expectedArtifact.verificationState === "VERIFIED" &&
      grant.conversation.status === "AUDIO_READY"
    ) {
      return {
        success: true,
        data: {
          conversationId: parsed.data.conversationId,
          version: grant.conversation.version,
        },
      };
    }
    if (grant.status === "REVOKED" || grant.status === "EXPIRED" || grant.expiresAt <= new Date()) {
      await rejectUploadedConversation(workspace.id, parsed.data.conversationId, grant.id, "UPLOAD_EXPIRED");
      return failure("UPLOAD_EXPIRED");
    }
    if (grant.status !== "ISSUED" && grant.status !== "COMPLETED") {
      return failure("INVALID_STATUS_TRANSITION");
    }

    const maximumBytes = Number(grant.maximumBytes);
    let objectHead;
    try {
      objectHead = await headObject(grant.stagingStorageKey);
    } catch (error) {
      if (isNotFoundStorageError(error)) return failure("UPLOAD_INCOMPLETE");
      throw error;
    }
    if (objectHead.byteSize < 1) {
      await rejectUploadedConversation(workspace.id, parsed.data.conversationId, grant.id, "UPLOAD_MISMATCH");
      return failure("UPLOAD_MISMATCH");
    }
    if (
      objectHead.byteSize !== Number(grant.declaredByteSize) ||
      (objectHead.contentType && objectHead.contentType.toLowerCase() !== grant.declaredMimeType)
    ) {
      await rejectUploadedConversation(workspace.id, parsed.data.conversationId, grant.id, "UPLOAD_MISMATCH");
      return failure("UPLOAD_MISMATCH");
    }
    if (objectHead.byteSize > maximumBytes) {
      await rejectUploadedConversation(workspace.id, parsed.data.conversationId, grant.id, "MEDIA_TOO_LARGE");
      return failure("MEDIA_TOO_LARGE");
    }

    const object = await readObjectBytes(grant.stagingStorageKey, maximumBytes);
    if (object.byteSize !== objectHead.byteSize || object.etag !== objectHead.etag) {
      return failure("UPLOAD_INCOMPLETE");
    }
    const verified = await verifyConversationMedia(
      object.bytes,
      conversationAudioConfig.maximumDurationMs,
    );
    if (!verified.success) {
      await rejectUploadedConversation(
        workspace.id,
        parsed.data.conversationId,
        grant.id,
        verified.code,
      );
      return failure(verified.code);
    }
    const checksum = createHash("sha256").update(object.bytes).digest("hex");
    await copyObject(
      grant.stagingStorageKey,
      grant.expectedArtifact.storageKey,
      objectHead.etag,
      verified.data.mimeType,
    );

    const result = await prisma.$transaction(
      async (tx) => {
        await assertRecordAccess(tx, session, workspace.id);
        const current = await tx.uploadGrant.findFirst({
          where: { id: grant.id, workspaceId: workspace.id },
          select: {
            id: true,
            status: true,
            stagingStorageKey: true,
            expectedArtifactId: true,
            conversation: {
              select: { id: true, status: true, version: true, deletionState: true, correlationId: true, sourceType: true },
            },
            expectedArtifact: { select: { verificationState: true } },
          },
        });
        if (!current || current.conversation.deletionState !== "ACTIVE") {
          await tx.cleanupTask.upsert({
            where: {
              resourceType_resourceId_deletionIntent: {
                resourceType: "upload_staging",
                resourceId: grant.id,
                deletionIntent: "late-promotion",
              },
            },
            create: {
              workspaceId: workspace.id,
              resourceType: "upload_staging",
              resourceId: grant.id,
              storageKey: grant.expectedArtifact.storageKey,
              deletionIntent: "late-promotion",
              correlationId: randomUUID(),
            },
            update: {},
          });
          return failure("NOT_FOUND");
        }
        if (
          current.status === "CONSUMED" &&
          current.expectedArtifact.verificationState === "VERIFIED" &&
          current.conversation.status === "AUDIO_READY"
        ) {
          return {
            success: true as const,
            data: {
              conversationId: current.conversation.id,
              version: current.conversation.version,
            },
          };
        }
        if (current.status !== "ISSUED" && current.status !== "COMPLETED") {
          return failure("INVALID_STATUS_TRANSITION");
        }
        const updated = await tx.conversation.updateMany({
          where: {
            id: current.conversation.id,
            workspaceId: workspace.id,
            status: "DRAFT",
            version: current.conversation.version,
            deletionState: "ACTIVE",
          },
          data: { status: "AUDIO_READY", version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new ConversationServiceError("STALE_VERSION");
        await tx.audioArtifact.update({
          where: { id: current.expectedArtifactId },
          data: {
            byteSize: BigInt(object.byteSize),
            durationMs: verified.data.durationMs,
            verifiedMimeType: verified.data.mimeType,
            verifiedContainer: verified.data.container,
            checksumAlgorithm: "SHA-256",
            checksum,
            verificationState: "VERIFIED",
          },
        });
        await tx.uploadGrant.update({
          where: { id: current.id },
          data: {
            status: "CONSUMED",
            completedAt: new Date(),
            consumedAt: new Date(),
          },
        });
        await tx.cleanupTask.upsert({
          where: {
            resourceType_resourceId_deletionIntent: {
              resourceType: "upload_staging",
              resourceId: current.id,
              deletionIntent: "post-verification",
            },
          },
          create: {
            workspaceId: workspace.id,
            resourceType: "upload_staging",
            resourceId: current.id,
            storageKey: current.stagingStorageKey,
            deletionIntent: "post-verification",
            correlationId: current.conversation.correlationId,
          },
          update: {},
        });
        await writeAudit(tx, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          conversationId: current.conversation.id,
          action: current.conversation.sourceType === "MICROPHONE"
            ? "conversation.recording.verify"
            : "conversation.upload.verify",
          outcome: "SUCCEEDED",
          correlationId: current.conversation.correlationId,
        });
        return {
          success: true as const,
          data: {
            conversationId: current.conversation.id,
            version: current.conversation.version + 1,
          },
        };
      },
      { isolationLevel: "Serializable" },
    );
    if (!result.success) return result;
    return result;
  } catch (error) {
    return serviceError(error);
  }
}

async function requestConversationDeletion(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    actorUserId: string;
    conversationId: string;
    expectedVersion: number;
    grantId?: string;
    action: string | ((sourceType: "MICROPHONE" | "UPLOAD") => string);
  },
): Promise<ServiceResponse<ConversationMutationResult>> {
  const current = await tx.conversation.findFirst({
    where: { id: input.conversationId, workspaceId: input.workspaceId },
    select: {
      id: true,
      status: true,
      version: true,
      deletionState: true,
      correlationId: true,
      sourceType: true,
      audioArtifact: { select: { id: true, storageKey: true } },
      uploadGrants: { select: { id: true, stagingStorageKey: true } },
      runs: {
        select: {
          id: true,
          status: true,
          reservation: { select: { id: true, status: true, quantity: true } },
          providerInvocations: {
            where: { providerAlias: "assemblyai", providerJobId: { not: null } },
            select: { id: true, providerJobId: true },
          },
        },
      },
    },
  });
  if (!current || current.deletionState !== "ACTIVE") return failure("NOT_FOUND");
  if (current.version !== input.expectedVersion) return failure("STALE_VERSION");
  if (input.grantId && !current.uploadGrants.some((grant) => grant.id === input.grantId)) {
    return failure("NOT_FOUND");
  }
  const updated = await tx.conversation.updateMany({
    where: {
      id: current.id,
      workspaceId: input.workspaceId,
      version: current.version,
      deletionState: "ACTIVE",
    },
    data: { deletionState: "DELETE_REQUESTED", version: { increment: 1 } },
  });
  if (updated.count !== 1) return failure("STALE_VERSION");
  await tx.audioArtifact.updateMany({
    where: { conversationId: current.id, workspaceId: input.workspaceId },
    data: { deletionState: "DELETE_REQUESTED" },
  });
  await tx.uploadGrant.updateMany({
    where: { conversationId: current.id, workspaceId: input.workspaceId, status: { in: ["ISSUED", "COMPLETED"] } },
    data: { status: "REVOKED" },
  });
  for (const run of current.runs) {
    if (run.reservation?.status === "ACTIVE") {
      const restored = await tx.creditReservation.updateMany({
        where: { id: run.reservation.id, workspaceId: input.workspaceId, status: "ACTIVE" },
        data: { status: "RESTORED", settledAt: new Date(), settlementReason: "CONVERSATION_DELETED" },
      });
      if (restored.count === 1) {
        await tx.creditEntry.create({
          data: {
            workspaceId: input.workspaceId,
            kind: "RESTORE",
            quantity: run.reservation.quantity,
            reservationId: run.reservation.id,
            processingRunId: run.id,
            reason: "CONVERSATION_DELETED",
            operationKey: `processing-restore-entry:${run.id}`,
          },
        });
      }
    }
    await tx.processingRun.updateMany({
      where: { id: run.id, workspaceId: input.workspaceId, status: { in: ["ACCEPTED", "RUNNING"] } },
      data: {
        status: "CANCELLED",
        terminalReason: "CONVERSATION_DELETED",
        retryable: false,
        finishedAt: new Date(),
      },
    });
    for (const invocation of run.providerInvocations) {
      await tx.cleanupTask.upsert({
        where: {
          resourceType_resourceId_deletionIntent: {
            resourceType: "assemblyai_transcript",
            resourceId: current.id,
            deletionIntent: `delete-remote:${invocation.id}`,
          },
        },
        create: {
          workspaceId: input.workspaceId,
          resourceType: "assemblyai_transcript",
          resourceId: current.id,
          providerReference: invocation.providerJobId,
          deletionIntent: `delete-remote:${invocation.id}`,
          requestedByUserId: input.actorUserId,
          correlationId: current.correlationId,
        },
        update: { providerReference: invocation.providerJobId },
      });
    }
  }
  await deleteConversationProposals(tx, input.workspaceId, current.id);
  await tx.speakerSegment.deleteMany({
    where: { workspaceId: input.workspaceId, diarizationVersion: { conversationId: current.id } },
  });
  await tx.transcriptEvidence.deleteMany({
    where: { workspaceId: input.workspaceId, transcript: { conversationId: current.id } },
  });
  await tx.diarizationVersion.deleteMany({
    where: { workspaceId: input.workspaceId, conversationId: current.id },
  });
  await tx.originalTranscript.deleteMany({
    where: { workspaceId: input.workspaceId, conversationId: current.id },
  });
  if (current.audioArtifact) {
    await tx.cleanupTask.upsert({
      where: {
        resourceType_resourceId_deletionIntent: {
          resourceType: "conversation_audio",
          resourceId: current.id,
          deletionIntent: "delete-final",
        },
      },
      create: {
        workspaceId: input.workspaceId,
        resourceType: "conversation_audio",
        resourceId: current.id,
        storageKey: current.audioArtifact.storageKey,
        deletionIntent: "delete-final",
        requestedByUserId: input.actorUserId,
        correlationId: current.correlationId,
      },
      update: {},
    });
  }
  for (const grant of current.uploadGrants) {
    await tx.cleanupTask.upsert({
      where: {
        resourceType_resourceId_deletionIntent: {
          resourceType: "conversation_audio",
          resourceId: current.id,
          deletionIntent: `delete-staging:${grant.id}`,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        resourceType: "conversation_audio",
        resourceId: current.id,
        storageKey: grant.stagingStorageKey,
        deletionIntent: `delete-staging:${grant.id}`,
        requestedByUserId: input.actorUserId,
        correlationId: current.correlationId,
      },
      update: {},
    });
  }
  await writeAudit(tx, {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    conversationId: current.id,
    action: typeof input.action === "function" ? input.action(current.sourceType) : input.action,
    outcome: "SUCCEEDED",
    correlationId: current.correlationId,
  });
  return { success: true, data: { conversationId: current.id, version: current.version + 1 } };
}

export async function discardConversationUpload(
  input: DiscardConversationUploadInput,
): Promise<ServiceResponse<ConversationMutationResult>> {
  const parsed = discardConversationUploadSchema.safeParse(input);
  if (!parsed.success) return failure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    return await prisma.$transaction(
      async (tx) => {
        await assertRecordAccess(tx, session, workspace.id);
        return requestConversationDeletion(tx, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          conversationId: parsed.data.conversationId,
          grantId: parsed.data.grantId,
          expectedVersion: parsed.data.expectedVersion,
          action: (sourceType) => sourceType === "MICROPHONE"
            ? "conversation.recording.discard"
            : "conversation.upload.discard",
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    return serviceError(error);
  }
}

export async function deleteConversation(
  input: DeleteConversationInput,
): Promise<ServiceResponse<ConversationMutationResult>> {
  const parsed = deleteConversationSchema.safeParse(input);
  if (!parsed.success) return failure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    return await prisma.$transaction(
      async (tx) => {
        await assertRecordAccess(tx, session, workspace.id);
        return requestConversationDeletion(tx, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          conversationId: parsed.data.id,
          expectedVersion: parsed.data.expectedVersion,
          action: "conversation.delete",
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    return serviceError(error);
  }
}

export async function getConversationAudioObject(
  id: string,
  requestHeaders?: Headers,
): Promise<ServiceResponse<{ storageKey: string; mimeType: string; byteSize: number }>> {
  const parsed = conversationIdSchema.safeParse(id);
  if (!parsed.success) return failure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace(requestHeaders);
    return await prisma.$transaction(
      async (tx) => {
        await assertRecordAccess(tx, session, workspace.id);
        const row = await tx.conversation.findFirst({
          where: {
            id: parsed.data,
            workspaceId: workspace.id,
            deletionState: "ACTIVE",
            audioArtifact: {
              is: { verificationState: "VERIFIED", deletionState: "ACTIVE" },
            },
          },
          select: {
            audioArtifact: {
              select: { storageKey: true, verifiedMimeType: true, byteSize: true },
            },
          },
        });
        const artifact = row?.audioArtifact;
        const byteSize = artifact ? safeBigInt(artifact.byteSize) : null;
        return artifact?.verifiedMimeType && byteSize
          ? { success: true as const, data: { storageKey: artifact.storageKey, mimeType: artifact.verifiedMimeType, byteSize } }
          : failure("NOT_FOUND");
      },
      { isolationLevel: "RepeatableRead" },
    );
  } catch (error) {
    return serviceError(error);
  }
}

async function expireUploadGrants(now: Date): Promise<number> {
  const grants = await prisma.uploadGrant.findMany({
    where: { status: { in: ["ISSUED", "COMPLETED"] }, expiresAt: { lte: now } },
    select: { id: true, workspaceId: true, conversationId: true },
    orderBy: { expiresAt: "asc" },
    take: cleanupBatchSize,
  });
  let expired = 0;
  for (const grant of grants) {
    const changed = await prisma.$transaction(
      async (tx) => {
        const current = await tx.uploadGrant.findFirst({
          where: { id: grant.id, workspaceId: grant.workspaceId, status: { in: ["ISSUED", "COMPLETED"] }, expiresAt: { lte: now } },
          select: {
            id: true,
            stagingStorageKey: true,
            expectedArtifact: { select: { storageKey: true } },
            conversation: { select: { id: true, deletionState: true, correlationId: true } },
          },
        });
        if (!current) return false;
        await tx.uploadGrant.update({ where: { id: current.id }, data: { status: "EXPIRED" } });
        if (current.conversation.deletionState === "ACTIVE") {
          await tx.conversation.update({
            where: { id: current.conversation.id },
            data: { deletionState: "DELETE_REQUESTED", version: { increment: 1 } },
          });
          await tx.audioArtifact.updateMany({
            where: { conversationId: current.conversation.id, workspaceId: grant.workspaceId },
            data: { deletionState: "DELETE_REQUESTED" },
          });
        }
        for (const task of [
          { intent: "delete-final", key: current.expectedArtifact.storageKey },
          { intent: `delete-staging:${current.id}`, key: current.stagingStorageKey },
        ]) {
          await tx.cleanupTask.upsert({
            where: {
              resourceType_resourceId_deletionIntent: {
                resourceType: "conversation_audio",
                resourceId: current.conversation.id,
                deletionIntent: task.intent,
              },
            },
            create: {
              workspaceId: grant.workspaceId,
              resourceType: "conversation_audio",
              resourceId: current.conversation.id,
              storageKey: task.key,
              deletionIntent: task.intent,
              correlationId: current.conversation.correlationId,
            },
            update: {},
          });
        }
        return true;
      },
      { isolationLevel: "Serializable" },
    );
    if (changed) expired++;
  }
  return expired;
}

async function finalizeDeletedConversation(conversationId: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: conversationId, deletionState: "DELETE_REQUESTED" },
        select: { id: true, workspaceId: true },
      });
      if (!conversation) return;
      const unfinished = await tx.cleanupTask.count({
        where: {
          resourceId: conversation.id,
          resourceType: { in: ["conversation_audio", "assemblyai_transcript"] },
          status: { notIn: ["SUCCEEDED", "CANCELLED"] },
        },
      });
      if (unfinished > 0) return;
      await tx.uploadGrant.deleteMany({
        where: { conversationId: conversation.id, workspaceId: conversation.workspaceId },
      });
      await tx.audioArtifact.deleteMany({
        where: { conversationId: conversation.id, workspaceId: conversation.workspaceId },
      });
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          deletionState: "DELETED",
          status: "CANCELLED",
          currentRunId: null,
          currentProposalRevisionId: null,
          version: { increment: 1 },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

export interface ConversationCleanupResult {
  expiredGrants: number;
  completedTasks: number;
  failedTasks: number;
}

export async function reconcileConversationAudioCleanup(): Promise<ConversationCleanupResult> {
  const now = new Date();
  const expiredGrants = await expireUploadGrants(now);
  const stuckBefore = new Date(now.getTime() - cleanupLeaseMs);
  const candidates = await prisma.cleanupTask.findMany({
    where: {
      OR: [
        { status: { in: ["PENDING", "FAILED"] }, availableAt: { lte: now } },
        { status: "RUNNING", updatedAt: { lte: stuckBefore } },
      ],
      resourceType: { in: ["conversation_audio", "upload_staging", "assemblyai_transcript"] },
    },
    select: { id: true, resourceType: true, resourceId: true, storageKey: true, providerReference: true, attempts: true },
    orderBy: [{ availableAt: "asc" }, { id: "asc" }],
    take: cleanupBatchSize,
  });
  let completedTasks = 0;
  let failedTasks = 0;
  for (const task of candidates) {
    const claimed = await prisma.cleanupTask.updateMany({
      where: {
        id: task.id,
        OR: [
          { status: { in: ["PENDING", "FAILED"] }, availableAt: { lte: now } },
          { status: "RUNNING", updatedAt: { lte: stuckBefore } },
        ],
      },
      data: { status: "RUNNING", attempts: { increment: 1 }, safeError: null },
    });
    if (claimed.count !== 1) continue;
    try {
      if (task.resourceType === "assemblyai_transcript" && task.providerReference) {
        const { createProductionSpeechProvider } = await import("@/lib/speech/assemblyai.provider");
        await createProductionSpeechProvider().delete(task.providerReference);
      } else if (task.storageKey) {
        await deleteObject(task.storageKey);
      }
      await prisma.cleanupTask.update({
        where: { id: task.id },
        data: { status: "SUCCEEDED", completedAt: new Date(), safeError: null },
      });
      completedTasks++;
      if (task.resourceType === "conversation_audio" || task.resourceType === "assemblyai_transcript") {
        await finalizeDeletedConversation(task.resourceId);
      }
    } catch {
      const attempts = task.attempts + 1;
      const delayMs = Math.min(maximumCleanupBackoffMs, 1000 * 2 ** Math.min(attempts, 12));
      await prisma.cleanupTask.update({
        where: { id: task.id },
        data: {
          status: "FAILED",
          safeError: task.resourceType === "assemblyai_transcript"
            ? "PROVIDER_DELETE_FAILED"
            : "STORAGE_DELETE_FAILED",
          availableAt: new Date(Date.now() + delayMs),
        },
      });
      failedTasks++;
    }
  }
  return { expiredGrants, completedTasks, failedTasks };
}
