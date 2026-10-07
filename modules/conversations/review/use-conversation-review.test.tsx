import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyRequestDraft, type ConversationReview } from "../lib/types/proposal.types";
import useConversationReview from "./use-conversation-review";

const mocks = vi.hoisted(() => ({ load: vi.fn(), history: vi.fn(), save: vi.fn(), ready: vi.fn(), reprocess: vi.fn(), resolve: vi.fn() }));
const translate = Object.assign((key: string) => key, { has: () => true });
vi.mock("next-intl", () => ({ useTranslations: () => translate }));
vi.mock("../lib/actions/reprocessing.actions", () => ({ startConversationReprocessingAction: mocks.reprocess, resolveReprocessingCandidateAction: mocks.resolve }));
vi.mock("../lib/actions/proposal.actions", () => ({ getConversationReviewAction: mocks.load, getProposalHistoryAction: mocks.history,
  saveProposalRevisionAction: mocks.save, markProposalReadyAction: mocks.ready }));
const review: ConversationReview = { conversationId: "conversation-a", version: 4, status: "needs_review", currentRevisionId: "revision-a", revision: {
  id: "revision-a", revisionNumber: 1, parentRevisionId: null, authorKind: "extraction", authorName: null,
  createdAt: "2026-09-08T00:00:00.000Z", readyAt: null, readyByName: null,
  draft: { client: { name: "Caller", email: "", phone: "", company: "", address: "", notes: "" }, requests: [emptyRequestDraft("item-a")] },
  fields: [], findings: [], canMarkReady: true,
} };

describe("useConversationReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.load.mockResolvedValue({ success: true, data: review });
  });

  it("reuses the start identity after a lost response and keeps the saved revision read-only", async () => {
    mocks.reprocess.mockRejectedValueOnce(new Error("lost")).mockResolvedValueOnce({ success: true, data: { conversationId: "conversation-a", version: 5, processingRunId: "run-b" } });
    const { result } = renderHook(() => useConversationReview("conversation-a", true, vi.fn().mockRejectedValue(new Error("refresh failed"))));
    await waitFor(() => expect(result.current.review).toBe(review));
    await act(async () => { await Promise.all([result.current.reprocess(), result.current.reprocess()]); });
    expect(mocks.reprocess).toHaveBeenCalledOnce();
    expect(result.current.review).toBe(review);
    await act(async () => { await result.current.reprocess(); });
    expect(mocks.reprocess.mock.calls[1][0].idempotencyKey).toBe(mocks.reprocess.mock.calls[0][0].idempotencyKey);
    expect(result.current.review?.revision).toBe(review.revision);
    expect(result.current.review?.status).toBe("extracting");
    expect(result.current.error).toBeNull();
    await act(async () => { await result.current.mutate(); await result.current.reprocess(); });
    expect(mocks.ready).not.toHaveBeenCalled();
    expect(mocks.reprocess).toHaveBeenCalledTimes(2);
  });

  it("protects an unresolved candidate and retries the exact explicit decision after a lost response", async () => {
    const pending = { ...review, candidate: { ...review.revision!, id: "candidate-b" } };
    mocks.load.mockResolvedValue({ success: true, data: pending });
    mocks.resolve.mockRejectedValueOnce(new Error("lost")).mockResolvedValueOnce({ success: true, data: { ...review, version: 5 } });
    const { result } = renderHook(() => useConversationReview("conversation-a", true, vi.fn()));
    await waitFor(() => expect(result.current.review).toBe(pending));
    await act(async () => { await result.current.mutate(review.revision!.draft); await result.current.reprocess(); });
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.reprocess).not.toHaveBeenCalled();
    const decision = { keepPrevious: true, clientFields: [], requests: [], removeRequestIds: [] };
    await act(async () => { await result.current.reprocess(decision); });
    expect(result.current.review?.candidate?.id).toBe("candidate-b");
    await act(async () => { await result.current.reprocess(decision); });
    expect(mocks.resolve.mock.calls[1][0]).toEqual(mocks.resolve.mock.calls[0][0]);
    expect(mocks.resolve).toHaveBeenLastCalledWith(expect.objectContaining({ ...decision, expectedVersion: 4, baseRevisionId: "revision-a", candidateRevisionId: "candidate-b" }));
    expect(result.current.review?.candidate).toBeUndefined();
    expect(result.current.review?.revision).toBe(review.revision);
  });

  it("deduplicates simultaneous saves and reuses its operation identity after a lost response", async () => {
    mocks.save.mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce({ success: true, data: review });
    const changed = vi.fn().mockRejectedValue(new Error("refresh failed"));
    const { result } = renderHook(() => useConversationReview("conversation-a", true, changed));
    await waitFor(() => expect(result.current.review).toBe(review));
    await act(async () => { await Promise.all([result.current.mutate(review.revision!.draft), result.current.mutate(review.revision!.draft)]); });
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(result.current.error).toBe("errors.INTERNAL_ERROR");
    await act(async () => { await result.current.mutate(review.revision!.draft); });
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(mocks.save.mock.calls[1][0].operationId).toBe(mocks.save.mock.calls[0][0].operationId);
    expect(result.current.error).toBeNull();
    expect(changed).toHaveBeenCalledOnce();
  });

  it("marks only the loaded revision ready using its optimistic version", async () => {
    mocks.ready.mockResolvedValue({ success: true, data: { ...review, status: "ready", version: 5 } });
    const { result } = renderHook(() => useConversationReview("conversation-a", true, vi.fn()));
    await waitFor(() => expect(result.current.review).toBe(review));
    await act(async () => { await result.current.mutate(); });
    expect(mocks.ready).toHaveBeenCalledWith({ conversationId: "conversation-a", expectedVersion: 4, revisionId: "revision-a" });
    expect(result.current.review?.status).toBe("ready");
  });

  it("paginates history without duplicating entries or replacing the current draft", async () => {
    const first = { ...review.revision!, id: "revision-a" };
    const second = { ...review.revision!, id: "revision-b" };
    mocks.history.mockResolvedValueOnce({ success: true, data: { revisions: [first], nextCursor: "revision-a" } })
      .mockResolvedValueOnce({ success: true, data: { revisions: [first, second], nextCursor: null } });
    const { result } = renderHook(() => useConversationReview("conversation-a", true, vi.fn()));
    await waitFor(() => expect(result.current.review).toBe(review));
    await act(async () => { await result.current.loadHistory(); });
    await act(async () => { await result.current.loadHistory("revision-a"); });
    expect(mocks.history).toHaveBeenLastCalledWith({ conversationId: "conversation-a", cursor: "revision-a" });
    expect(result.current.history?.revisions.map((entry) => entry.id)).toEqual(["revision-a", "revision-b"]);
    expect(result.current.history?.nextCursor).toBeNull();
    expect(result.current.review).toBe(review);
  });

  it("retains the newest creation status when the initial review request arrives later", async () => {
    let finish!: (value: unknown) => void;
    mocks.load.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useConversationReview("conversation-a", true, vi.fn()));
    await waitFor(() => expect(mocks.load).toHaveBeenCalledOnce());
    act(() => { result.current.syncCreationState({ version: 7, status: "completed", revisionId: "revision-a" }); });
    await act(async () => { finish({ success: true, data: review }); });
    expect(result.current.review?.status).toBe("completed"); expect(result.current.review?.version).toBe(7);
    expect(result.current.review?.revision?.draft).toEqual(review.revision?.draft);
  });

  it("preserves the draft and requires explicit reload when creation discovers a newer revision", async () => {
    const { result } = renderHook(() => useConversationReview("conversation-a", true, vi.fn()));
    await waitFor(() => expect(result.current.review).toBe(review));
    act(() => { result.current.syncCreationState({ version: 6, status: "ready", revisionId: "revision-b" }); });
    expect(result.current.conflict).toBe(true); expect(result.current.review).toBe(review);
    await act(async () => { await result.current.mutate(review.revision!.draft); });
    expect(mocks.save).not.toHaveBeenCalled();
    mocks.load.mockResolvedValue({ success: true, data: { ...review, version: 6, currentRevisionId: "revision-b", revision: { ...review.revision!, id: "revision-b" } } });
    await act(async () => { await result.current.load(); });
    expect(result.current.conflict).toBe(false); expect(result.current.review?.currentRevisionId).toBe("revision-b");
  });
});
