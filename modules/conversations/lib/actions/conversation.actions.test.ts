import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  prepareRecording: vi.fn(),
  list: vi.fn(),
  startProcessing: vi.fn(),
}));
vi.mock("../services/processing.services", () => ({
  startConversationProcessing: mocks.startProcessing,
}));

vi.mock("../services/conversation.services", () => ({
  completeConversationUpload: vi.fn(),
  deleteConversation: vi.fn(),
  discardConversationUpload: vi.fn(),
  getConversationById: vi.fn(),
  getConversationUploadPolicy: vi.fn(),
  getConversations: mocks.list,
  prepareConversationUpload: mocks.prepare,
  prepareConversationRecording: mocks.prepareRecording,
}));

import {
  getConversationsAction,
  prepareConversationRecordingAction,
  prepareConversationUploadAction,
  startConversationProcessingAction,
} from "./conversation.actions";

describe("conversation actions", () => {
  beforeEach(() => {
    mocks.prepare.mockResolvedValue({ success: true, data: {} });
    mocks.prepareRecording.mockResolvedValue({ success: true, data: {} });
    mocks.list.mockResolvedValue({ success: true, data: {} });
    mocks.startProcessing.mockResolvedValue({ success: true, data: {} });
  });

  it("validates and delegates a processing start without accepting workspace authority", async () => {
    const input = {
      conversationId: "conversation-a",
      expectedVersion: 2,
      idempotencyKey: "37fd4cb8-d9e1-4bd5-8314-0f5d3e2c6191",
    };
    await startConversationProcessingAction(input);
    expect(mocks.startProcessing).toHaveBeenCalledWith(input);

    await expect(startConversationProcessingAction({ ...input, workspaceId: "forged" }))
      .resolves.toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("uses a separate server-owned preparation path for microphone recordings", async () => {
    const input = {
      locale: "en",
      originalFilename: "conversation.webm",
      declaredMimeType: "audio/webm",
      declaredByteSize: 256,
      idempotencyKey: "37fd4cb8-d9e1-4bd5-8314-0f5d3e2c6191",
    };

    await prepareConversationRecordingAction(input);

    expect(mocks.prepareRecording).toHaveBeenCalledWith(input);
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("delegates only normalized filters", async () => {
    await getConversationsAction({ page: "2", limit: "10" });
    expect(mocks.list).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("rejects forged source/workspace fields before calling the service", async () => {
    const input = {
      locale: "es",
      originalFilename: "call.mp3",
      declaredMimeType: "audio/mpeg",
      declaredByteSize: 128,
      idempotencyKey: "37fd4cb8-d9e1-4bd5-8314-0f5d3e2c6191",
    };
    await expect(prepareConversationUploadAction({ ...input, sourceType: "microphone" })).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    await expect(prepareConversationUploadAction({ ...input, workspaceId: "other" })).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
});
