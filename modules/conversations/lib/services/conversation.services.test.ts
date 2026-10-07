import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    uploadGrant: {
      findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(),
      updateMany: vi.fn(), deleteMany: vi.fn(),
    },
    conversation: {
      create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(),
    },
    audioArtifact: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    processingRun: { updateMany: vi.fn() },
    creditReservation: { updateMany: vi.fn() },
    creditEntry: { create: vi.fn(), groupBy: vi.fn() },
    speakerSegment: { deleteMany: vi.fn() },
    transcriptEvidence: { deleteMany: vi.fn() },
    diarizationVersion: { deleteMany: vi.fn() },
    originalTranscript: { deleteMany: vi.fn() },
    recordPlan: { updateMany: vi.fn() },
    operationReceipt: { updateMany: vi.fn() },
    proposalFieldEvidence: { deleteMany: vi.fn() },
    proposalFinding: { deleteMany: vi.fn() },
    proposalField: { deleteMany: vi.fn() },
    proposalRequestItem: { deleteMany: vi.fn() },
    proposalClientDraft: { deleteMany: vi.fn() },
    proposalRevision: { deleteMany: vi.fn() },
    auditEvent: { create: vi.fn() },
    cleanupTask: { upsert: vi.fn(), count: vi.fn() },
  };
  return {
    tx,
    resolve: vi.fn(),
    sign: vi.fn(), head: vi.fn(), read: vi.fn(), copy: vi.fn(), remove: vi.fn(),
    verify: vi.fn(),
    grantFindMany: vi.fn(), cleanupFindMany: vi.fn(), cleanupUpdateMany: vi.fn(), cleanupUpdate: vi.fn(),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
});

vi.mock("@/lib/auth/session", () => ({ resolveCurrentWorkspace: mocks.resolve }));
vi.mock("@/lib/persistence/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    uploadGrant: { findMany: mocks.grantFindMany },
    cleanupTask: {
      findMany: mocks.cleanupFindMany,
      updateMany: mocks.cleanupUpdateMany,
      update: mocks.cleanupUpdate,
    },
  },
}));
vi.mock("@/lib/records/record-policy", () => ({
  assertRecordAccess: vi.fn(),
  isRetryableRecordConflict: vi.fn(() => false),
}));
vi.mock("@/lib/storage/storage.service", () => ({
  copyObject: mocks.copy,
  createSignedUploadUrlForKey: mocks.sign,
  deleteObject: mocks.remove,
  headObject: mocks.head,
  readObjectBytes: mocks.read,
}));
vi.mock("./media-verification.service", () => ({ verifyConversationMedia: mocks.verify }));

import {
  completeConversationUpload,
  deleteConversation,
  discardConversationUpload,
  prepareConversationRecording,
  prepareConversationUpload,
  reconcileConversationAudioCleanup,
} from "./conversation.services";

const prepareInput = {
  locale: "es" as const,
  originalFilename: "recording.m4a",
  declaredMimeType: "audio/x-m4a",
  declaredByteSize: 1_024,
  idempotencyKey: "37fd4cb8-d9e1-4bd5-8314-0f5d3e2c6191",
};

function initialGrant(overrides: Record<string, unknown> = {}) {
  return {
    id: "grant-a",
    status: "ISSUED",
    expiresAt: new Date(Date.now() + 60_000),
    maximumBytes: BigInt(2_048),
    declaredByteSize: BigInt(3),
    declaredMimeType: "audio/mpeg",
    stagingStorageKey: "staging/a",
    expectedArtifact: { id: "artifact-a", storageKey: "final/a", verificationState: "PENDING" },
    conversation: { status: "DRAFT", deletionState: "ACTIVE", version: 1 },
    ...overrides,
  };
}

function completionGrant(overrides: Record<string, unknown> = {}) {
  return {
    id: "grant-a",
    status: "ISSUED",
    stagingStorageKey: "staging/a",
    expectedArtifactId: "artifact-a",
    expectedArtifact: { verificationState: "PENDING" },
    conversation: {
      id: "conversation-a",
      status: "DRAFT",
      version: 1,
      deletionState: "ACTIVE",
      correlationId: "correlation-a",
    },
    ...overrides,
  };
}

describe("conversation services", () => {
  beforeEach(() => {
    mocks.resolve.mockResolvedValue({
      session: { user: { id: "user-a" }, session: { id: "session-a" } },
      workspace: { id: "workspace-a" },
    });
    mocks.tx.uploadGrant.findUnique.mockResolvedValue(null);
    mocks.tx.conversation.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.uploadGrant.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.creditReservation.updateMany.mockResolvedValue({ count: 1 });
    mocks.sign.mockResolvedValue({ key: "staging", url: "https://storage.example/upload", expiresIn: 900 });
    mocks.head.mockResolvedValue({ byteSize: 3, contentType: "audio/mpeg", etag: '"etag"' });
    mocks.read.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]), byteSize: 3, contentType: "audio/mpeg",
      contentRange: null, etag: '"etag"',
    });
    mocks.verify.mockResolvedValue({
      success: true,
      data: { container: "MPEG", durationMs: 1_000, mimeType: "audio/mpeg" },
    });
    mocks.grantFindMany.mockResolvedValue([]);
    mocks.cleanupFindMany.mockResolvedValue([]);
    mocks.cleanupUpdateMany.mockResolvedValue({ count: 1 });
    mocks.tx.cleanupTask.count.mockResolvedValue(0);
  });

  it("derives workspace/provenance on the server and signs only staging", async () => {
    const result = await prepareConversationUpload(prepareInput);
    expect(result).toMatchObject({ success: true, data: { version: 1, requiredContentType: "audio/x-m4a" } });
    expect(mocks.tx.conversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ workspaceId: "workspace-a", sourceType: "UPLOAD", locale: "es" }),
    });
    expect(mocks.tx.uploadGrant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-a", declaredMimeType: "audio/x-m4a", declaredByteSize: BigInt(1_024),
      }),
    });
    expect(mocks.sign).toHaveBeenCalledWith(
      expect.objectContaining({ key: expect.stringMatching(/^conversation-staging\/workspace-a\//) }),
      expect.any(Number),
    );
  });

  it("persists microphone provenance and recording-specific audit events", async () => {
    await expect(prepareConversationRecording({
      ...prepareInput,
      originalFilename: "conversation.webm",
      declaredMimeType: "audio/webm",
    })).resolves.toMatchObject({ success: true, data: { requiredContentType: "audio/webm" } });

    expect(mocks.tx.conversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sourceType: "MICROPHONE" }),
    });
    expect(mocks.tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "conversation.recording.prepare" }),
    });
  });

  it("rejects reuse of an idempotency key for a different intent", async () => {
    mocks.tx.uploadGrant.findUnique.mockResolvedValue({
      id: "grant-a", workspaceId: "workspace-a", conversationId: "conversation-a",
      stagingStorageKey: "staging/a", declaredMimeType: "audio/mpeg", declaredByteSize: BigInt(2_048),
      expiresAt: new Date(Date.now() + 60_000), status: "ISSUED",
      conversation: { locale: "es", sourceType: "UPLOAD", version: 1 },
      expectedArtifact: { originalFilename: "other.mp3" },
    });
    await expect(prepareConversationUpload(prepareInput)).resolves.toMatchObject({
      success: false, error: { code: "IDEMPOTENCY_CONFLICT" },
    });
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("permits the generic browser MIME fallback only for approved extensions", async () => {
    await expect(prepareConversationUpload({
      ...prepareInput, originalFilename: "recording.exe", declaredMimeType: "application/octet-stream",
    })).resolves.toMatchObject({ success: false, error: { code: "UNSUPPORTED_MEDIA" } });
    expect(mocks.transaction).not.toHaveBeenCalled();

    await expect(prepareConversationUpload({
      ...prepareInput, originalFilename: "recording.oga", declaredMimeType: "application/octet-stream",
    })).resolves.toMatchObject({
      success: true,
      data: { requiredContentType: "application/octet-stream" },
    });

    await expect(prepareConversationUpload({
      ...prepareInput, originalFilename: "recording.weba", declaredMimeType: "application/octet-stream",
    })).resolves.toMatchObject({
      success: true,
      data: { requiredContentType: "application/octet-stream" },
    });

    await expect(prepareConversationUpload({
      ...prepareInput, originalFilename: "recording.mpeg", declaredMimeType: "application/octet-stream",
    })).resolves.toMatchObject({
      success: true,
      data: { requiredContentType: "application/octet-stream" },
    });
  });

  it("promotes verified bytes and returns the idempotent replay without touching storage", async () => {
    mocks.tx.uploadGrant.findFirst
      .mockResolvedValueOnce(initialGrant())
      .mockResolvedValueOnce(completionGrant());
    await expect(completeConversationUpload({ conversationId: "conversation-a", grantId: "grant-a" }))
      .resolves.toEqual({ success: true, data: { conversationId: "conversation-a", version: 2 } });
    expect(mocks.copy).toHaveBeenCalledWith("staging/a", "final/a", '"etag"', "audio/mpeg");
    expect(mocks.tx.audioArtifact.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ verificationState: "VERIFIED", checksumAlgorithm: "SHA-256" }),
    }));
    expect(mocks.tx.uploadGrant.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CONSUMED" }),
    }));

    vi.clearAllMocks();
    mocks.resolve.mockResolvedValue({
      session: { user: { id: "user-a" }, session: { id: "session-a" } }, workspace: { id: "workspace-a" },
    });
    mocks.transaction.mockImplementation(async (callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.tx.uploadGrant.findFirst.mockResolvedValue(initialGrant({
      status: "CONSUMED",
      expectedArtifact: { id: "artifact-a", storageKey: "final/a", verificationState: "VERIFIED" },
      conversation: { status: "AUDIO_READY", deletionState: "ACTIVE", version: 2 },
    }));
    await expect(completeConversationUpload({ conversationId: "conversation-a", grantId: "grant-a" }))
      .resolves.toEqual({ success: true, data: { conversationId: "conversation-a", version: 2 } });
    expect(mocks.head).not.toHaveBeenCalled();
    expect(mocks.copy).not.toHaveBeenCalled();
  });

  it("fails the conversation CAS before artifact/grant mutations", async () => {
    mocks.tx.uploadGrant.findFirst
      .mockResolvedValueOnce(initialGrant())
      .mockResolvedValueOnce(completionGrant());
    mocks.tx.conversation.updateMany.mockResolvedValue({ count: 0 });
    await expect(completeConversationUpload({ conversationId: "conversation-a", grantId: "grant-a" }))
      .resolves.toMatchObject({ success: false, error: { code: "STALE_VERSION" } });
    expect(mocks.tx.audioArtifact.update).not.toHaveBeenCalled();
    expect(mocks.tx.uploadGrant.update).not.toHaveBeenCalled();
  });

  it("tombstones a definitive stored-object mismatch without marking it retryable", async () => {
    mocks.tx.uploadGrant.findFirst
      .mockResolvedValueOnce(initialGrant())
      .mockResolvedValueOnce({
        id: "grant-a",
        stagingStorageKey: "staging/a",
        expectedArtifactId: "artifact-a",
        conversation: { correlationId: "correlation-a", deletionState: "ACTIVE" },
      });
    mocks.head.mockResolvedValue({ byteSize: 4, contentType: "audio/mpeg", etag: '"etag"' });

    await expect(completeConversationUpload({ conversationId: "conversation-a", grantId: "grant-a" }))
      .resolves.toMatchObject({ success: false, error: { code: "UPLOAD_MISMATCH" } });

    expect(mocks.copy).not.toHaveBeenCalled();
    expect(mocks.tx.uploadGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "REVOKED" },
    }));
    expect(mocks.tx.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deletionState: "DELETE_REQUESTED" }),
    }));
    expect(mocks.tx.cleanupTask.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ storageKey: "staging/a" }),
    }));
  });

  it("tombstones a deletable conversation, creates cleanup tasks, and enforces version/state", async () => {
    mocks.tx.conversation.findFirst.mockResolvedValue({
      id: "conversation-a", status: "AUDIO_READY", version: 2, deletionState: "ACTIVE",
      correlationId: "correlation-a", audioArtifact: { id: "artifact-a", storageKey: "final/a" },
      uploadGrants: [{ id: "grant-a", stagingStorageKey: "staging/a" }],
      runs: [],
    });
    await expect(deleteConversation({ id: "conversation-a", expectedVersion: 2 })).resolves.toEqual({
      success: true, data: { conversationId: "conversation-a", version: 3 },
    });
    expect(mocks.tx.cleanupTask.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.tx.uploadGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "REVOKED" },
    }));

    mocks.tx.conversation.findFirst.mockResolvedValueOnce({
      id: "conversation-a", status: "QUEUED", version: 2, deletionState: "ACTIVE",
      correlationId: "correlation-a", audioArtifact: null, uploadGrants: [{ id: "grant-a", stagingStorageKey: "staging/a" }],
      runs: [],
    });
    await expect(discardConversationUpload({
      conversationId: "conversation-a", grantId: "grant-a", expectedVersion: 1,
    })).resolves.toMatchObject({ success: false, error: { code: "STALE_VERSION" } });
  });

  it("backs off failed cleanup, then succeeds and physically finalizes a tombstone", async () => {
    const task = {
      id: "task-a", resourceType: "conversation_audio", resourceId: "conversation-a",
      storageKey: "final/a", attempts: 0,
    };
    mocks.cleanupFindMany.mockResolvedValueOnce([task]);
    mocks.remove.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(reconcileConversationAudioCleanup()).resolves.toEqual({
      expiredGrants: 0, completedTasks: 0, failedTasks: 1,
    });
    expect(mocks.cleanupUpdate).toHaveBeenCalledWith({
      where: { id: "task-a" },
      data: expect.objectContaining({ status: "FAILED", safeError: "STORAGE_DELETE_FAILED", availableAt: expect.any(Date) }),
    });

    mocks.cleanupFindMany.mockResolvedValueOnce([{ ...task, attempts: 1 }]);
    mocks.remove.mockResolvedValueOnce(undefined);
    mocks.tx.conversation.findFirst.mockResolvedValueOnce({ id: "conversation-a", workspaceId: "workspace-a" });
    await expect(reconcileConversationAudioCleanup()).resolves.toEqual({
      expiredGrants: 0, completedTasks: 1, failedTasks: 0,
    });
    expect(mocks.tx.uploadGrant.deleteMany).toHaveBeenCalled();
    expect(mocks.tx.audioArtifact.deleteMany).toHaveBeenCalled();
    expect(mocks.tx.conversation.update).toHaveBeenCalledWith({
      where: { id: "conversation-a" },
      data: expect.objectContaining({ deletionState: "DELETED", status: "CANCELLED", currentRunId: null }),
    });
  });

  it("schedules remote cleanup for provider jobs from failed runs and purges local evidence", async () => {
    mocks.tx.conversation.findFirst.mockResolvedValue({
      id: "conversation-a", status: "FAILED", version: 4, deletionState: "ACTIVE",
      correlationId: "correlation-a", audioArtifact: null, uploadGrants: [],
      runs: [{
        id: "run-failed", status: "FAILED",
        reservation: { id: "reservation-a", status: "RESTORED", quantity: 1 },
        providerInvocations: [{ id: "invocation-a", providerJobId: "assembly-job-a" }],
      }],
    });
    await expect(deleteConversation({ id: "conversation-a", expectedVersion: 4 }))
      .resolves.toMatchObject({ success: true });
    expect(mocks.tx.cleanupTask.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        resourceType: "assemblyai_transcript",
        providerReference: "assembly-job-a",
      }),
    }));
    expect(mocks.tx.speakerSegment.deleteMany).toHaveBeenCalled();
    expect(mocks.tx.transcriptEvidence.deleteMany).toHaveBeenCalled();
    expect(mocks.tx.originalTranscript.deleteMany).toHaveBeenCalled();
    expect(mocks.tx.creditEntry.create).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ kind: "RESTORE" }),
    }));
  });
});
