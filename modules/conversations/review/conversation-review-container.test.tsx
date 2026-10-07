import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationDetails } from "../lib/types/conversation.types";
import { emptyRequestDraft, type ConversationReview } from "../lib/types/proposal.types";
import ConversationReviewContainer from "./conversation-review-container";

const mocks = vi.hoisted(() => ({ load: vi.fn(), history: vi.fn(), save: vi.fn(), ready: vi.fn(), toast: vi.fn(), creation: vi.fn(), prepare: vi.fn(), reprocess: vi.fn(), resolve: vi.fn() }));
const translate = Object.assign((key: string, values?: Record<string, unknown>) => values?.number ? `${key} ${values.number}` : key, { has: () => true });
vi.mock("next-intl", () => ({ useTranslations: () => translate, useFormatter: () => ({ dateTime: () => "date" }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toast } }));
vi.mock("../lib/actions/reprocessing.actions", () => ({ startConversationReprocessingAction: mocks.reprocess, resolveReprocessingCandidateAction: mocks.resolve }));
vi.mock("../lib/actions/conversation-creation.actions", () => ({ getConversationCreationStateAction: mocks.creation,
  prepareConversationCreationAction: mocks.prepare, confirmConversationCreationAction: vi.fn(), abandonConversationCreationAction: vi.fn() }));
vi.mock("@/modules/clients/details/client-details-container", () => ({ default: () => null }));
vi.mock("@/modules/requests/details/service-request-details-container", () => ({ default: () => null }));
vi.mock("../lib/actions/proposal.actions", () => ({ getConversationReviewAction: mocks.load, getProposalHistoryAction: mocks.history,
  saveProposalRevisionAction: mocks.save, markProposalReadyAction: mocks.ready }));

function review(name = "Original", id = "revision-1"): ConversationReview {
  return { conversationId: "conversation-a", version: 4, status: "needs_review", currentRevisionId: id, revision: {
    id, revisionNumber: 1, parentRevisionId: null, authorKind: "extraction", authorName: null,
    createdAt: "2026-09-08T00:00:00.000Z", readyAt: null, readyByName: null,
    draft: { client: { name, email: "", phone: "", company: "", address: "", notes: "" }, requests: [emptyRequestDraft("item-a")] },
    fields: [], findings: [], canMarkReady: true,
  } };
}
const conversation: ConversationDetails = {
  id: "conversation-a", sourceType: "upload", locale: "es", status: "needs_review", version: 4,
  createdAt: "2026-09-08T00:00:00.000Z", updatedAt: "2026-09-08T00:00:00.000Z", durationMs: 1000,
  originalFilename: "sample.webm", audio: null, credits: { available: 8, consumed: 1, reserved: 0 }, processingRun: null, transcript: null,
};
const input = () => screen.getByRole("textbox", { name: "name" }) as HTMLInputElement;
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("ConversationReviewContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    mocks.load.mockResolvedValue({ success: true, data: review() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("requires saved changes and confirmation before reprocessing, then preserves the current revision", async () => {
    mocks.reprocess.mockResolvedValue({ success: true, data: { conversationId: conversation.id, version: 5, processingRunId: "run-b" } });
    render(<ConversationReviewContainer conversation={conversation} onChanged={vi.fn()} onSeek={vi.fn()} />);
    await waitFor(() => expect(input().value).toBe("Original"));
    fireEvent.change(input(), { target: { value: "Unsaved" } });
    expect(button("reprocessing.start").disabled).toBe(true);
    fireEvent.change(input(), { target: { value: "Original" } });
    fireEvent.click(button("reprocessing.start"));
    expect(mocks.reprocess).not.toHaveBeenCalled();
    const confirmation = screen.getByRole("alertdialog");
    expect(within(confirmation).getByText("reprocessing.confirmDescription")).toBeTruthy();
    fireEvent.click(within(confirmation).getByRole("button", { name: "reprocessing.confirm" }));
    await screen.findByText("reprocessing.processing");
    expect(screen.queryByRole("textbox", { name: "name" })).toBeNull();
    expect(screen.getByText("Original")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "reprocessing.start" })).toBeNull();
  });

  it("loads a persisted candidate and preserves comparison selections while viewing history", async () => {
    const pending = review(); pending.candidate = { ...review("New name", "candidate-2").revision! };
    mocks.load.mockResolvedValue({ success: true, data: pending });
    mocks.history.mockResolvedValue({ success: true, data: { revisions: [pending.revision], nextCursor: null } });
    const guard = vi.fn();
    render(<ConversationReviewContainer conversation={conversation} onChanged={vi.fn()} onSeek={vi.fn()} onGuardChange={guard} />);
    const comparison = await screen.findByRole("region", { name: "compareTitle" });
    expect(screen.queryByRole("textbox", { name: "name" })).toBeNull();
    const checkbox = within(comparison).getAllByRole("checkbox")[0];
    fireEvent.click(checkbox);
    await waitFor(() => expect(guard).toHaveBeenLastCalledWith({ dirty: true, busy: false }));
    fireEvent.click(button("history"));
    await screen.findByRole("button", { name: "revisionAttribution 1" });
    fireEvent.click(button("revisionAttribution 1"));
    await screen.findByRole("region", { name: "preview" });
    expect(screen.queryByRole("region", { name: "compareTitle" })).toBeNull();
    fireEvent.click(button("returnToDraft"));
    expect(checkbox.getAttribute("data-state")).toBe("checked");
    expect(guard).toHaveBeenLastCalledWith({ dirty: true, busy: false });
  });

  it("preserves an unsaved correction when another tab starts reprocessing and requests an explicit reload", async () => {
    const changed = vi.fn();
    const { rerender } = render(<ConversationReviewContainer conversation={conversation} onChanged={changed} onSeek={vi.fn()} />);
    await waitFor(() => expect(input().value).toBe("Original"));
    const draftInput = input();
    fireEvent.change(draftInput, { target: { value: "Unsaved local correction" } });
    rerender(<ConversationReviewContainer conversation={{ ...conversation, status: "extracting", version: 5 }} onChanged={changed} onSeek={vi.fn()} />);
    await screen.findByText("conflictHint");
    expect(draftInput.value).toBe("Unsaved local correction");
    expect(mocks.load).toHaveBeenCalledOnce();
    expect(screen.queryByRole("textbox", { name: "name" })).toBeNull();
    expect(screen.getByRole("button", { name: "discardReload" })).toBeTruthy();
  });

  it("preserves a dirty draft on detail refresh and blocks readiness until explicit saving", async () => {
    const changed = vi.fn();
    const guard = vi.fn();
    const { rerender } = render(<ConversationReviewContainer conversation={conversation} onChanged={changed} onGuardChange={guard} onSeek={vi.fn()} />);
    await waitFor(() => expect(input().value).toBe("Original"));
    expect(button("markReady").disabled).toBe(false);
    fireEvent.change(input(), { target: { value: "Human correction" } });
    expect(button("markReady").disabled).toBe(true);
    expect(guard).toHaveBeenLastCalledWith({ dirty: true, busy: false });
    rerender(<ConversationReviewContainer conversation={{ ...conversation, version: 5 }} onChanged={changed} onGuardChange={guard} onSeek={vi.fn()} />);
    expect(input().value).toBe("Human correction");
    expect(mocks.load).toHaveBeenCalledOnce();
    const saved = review("Human correction", "revision-2");
    mocks.save.mockResolvedValue({ success: true, data: saved });
    fireEvent.click(button("save"));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("saved"));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "conversation-a", expectedVersion: 4,
      baseRevisionId: "revision-1", draft: saved.revision!.draft, resolutions: [] }));
    expect(guard).toHaveBeenLastCalledWith({ dirty: false, busy: false });
    expect(button("save").disabled).toBe(true);
    expect(button("markReady").disabled).toBe(false);
  });

  it("preserves local edits after conflict while previewing the current revision, then reloads only after confirmation", async () => {
    mocks.save.mockResolvedValue({ success: false, error: { code: "STALE_VERSION", message: "private" } });
    render(<ConversationReviewContainer conversation={conversation} onChanged={vi.fn()} onSeek={vi.fn()} />);
    await waitFor(() => expect(input().value).toBe("Original"));
    fireEvent.change(input(), { target: { value: "Local correction" } });
    fireEvent.click(button("save"));
    await screen.findByText("conflictHint");
    expect(input().value).toBe("Local correction");
    expect(button("save").disabled).toBe(true);
    mocks.load.mockResolvedValue({ success: true, data: review("Other editor", "revision-2") });
    fireEvent.click(button("viewCurrent"));
    const preview = await screen.findByRole("region", { name: "preview" });
    expect(within(preview).getByText("Other editor")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "name" })).toBeNull();
    fireEvent.click(button("returnToDraft"));
    expect(input().value).toBe("Local correction");
    const localInput = input();
    fireEvent.click(button("discardReload"));
    expect(localInput.value).toBe("Local correction");
    const confirmation = screen.getByRole("alertdialog");
    fireEvent.click(within(confirmation).getByRole("button", { name: "discardReload" }));
    await waitFor(() => expect(input().value).toBe("Other editor"));
    expect(button("save").disabled).toBe(true);
  });

  it("retains at least one request and keeps retained request identity when adding and removing", async () => {
    render(<ConversationReviewContainer conversation={conversation} onChanged={vi.fn()} onSeek={vi.fn()} />);
    await waitFor(() => expect(input().value).toBe("Original"));
    expect(button("removeRequestNumber 1").disabled).toBe(true);
    fireEvent.click(button("addRequest"));
    expect(button("removeRequestNumber 1").disabled).toBe(false);
    fireEvent.click(button("removeRequestNumber 2"));
    expect(button("removeRequestNumber 1").disabled).toBe(true);
    fireEvent.change(input(), { target: { value: "Changed" } });
    mocks.save.mockResolvedValue({ success: true, data: review("Changed") });
    fireEvent.click(button("save"));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    expect(mocks.save.mock.calls[0][0].draft.requests.map((item: { stableItemId: string }) => item.stableItemId)).toEqual(["item-a"]);
  });

  it("saves explicit finding resolutions and prevents closing while a save is pending", async () => {
    const proposed = review();
    proposed.revision!.canMarkReady = false;
    proposed.revision!.findings = [
      { id: "ambiguity", code: "AMBIGUITY", severity: "blocking", target: "client", itemId: null, fieldKey: "name", resolution: null },
      { id: "missing", code: "MISSING_REQUIRED", severity: "blocking", target: "client", itemId: null, fieldKey: "email", resolution: null },
    ];
    mocks.load.mockResolvedValue({ success: true, data: proposed });
    let finish!: (result: unknown) => void;
    mocks.save.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const guard = vi.fn();
    render(<ConversationReviewContainer conversation={conversation} onChanged={vi.fn()} onGuardChange={guard} onSeek={vi.fn()} />);
    await waitFor(() => expect(input().value).toBe("Original"));
    expect(screen.getAllByRole("textbox", { name: "resolutionReason" })).toHaveLength(1);
    fireEvent.change(screen.getByRole("textbox", { name: "resolutionReason" }), { target: { value: "  Confirmed with the caller  " } });
    fireEvent.click(button("save"));
    await waitFor(() => expect(guard).toHaveBeenLastCalledWith({ dirty: true, busy: true }));
    expect(mocks.save.mock.calls[0][0].resolutions).toEqual([{ findingId: "ambiguity", reason: "Confirmed with the caller" }]);
    await act(async () => finish({ success: true, data: proposed }));
    expect(button("markReady").disabled).toBe(true);
  });

  it("allows creation only for a saved ready revision and retains local changes", async () => {
    const ready = review(); ready.status = "ready"; ready.revision!.readyAt = "2026-09-08T00:00:00Z";
    mocks.load.mockResolvedValue({ success: true, data: ready });
    render(<ConversationReviewContainer conversation={{ ...conversation, status: "ready" }} onChanged={vi.fn()} onSeek={vi.fn()} />);
    await waitFor(() => expect(input().value).toBe("Original"));
    expect(button("start").disabled).toBe(false);
    fireEvent.change(input(), { target: { value: "Unsaved correction" } });
    expect(button("start").disabled).toBe(true);
    fireEvent.click(button("start"));
    expect(mocks.creation).not.toHaveBeenCalled(); expect(input().value).toBe("Unsaved correction");
  });

  it("keeps a completed conversation read only when an older review response arrives", async () => {
    const ready = review(); ready.status = "ready"; ready.revision!.readyAt = "2026-09-08T00:00:00Z";
    mocks.load.mockResolvedValue({ success: true, data: ready });
    mocks.creation.mockResolvedValue({ success: true, data: { conversationId: conversation.id, version: 6, revisionId: ready.currentRevisionId,
      status: "completed", preview: null, duplicates: [], result: { operationId: "operation-a", conversationId: conversation.id, clientId: "client-a",
        requestIds: ["request-a"], completedAt: "2026-09-08T00:00:00Z", replayed: true } } });
    render(<ConversationReviewContainer conversation={{ ...conversation, status: "completed", version: 6 }} onChanged={vi.fn()} onSeek={vi.fn()} />);
    await screen.findByRole("region", { name: "receiptTitle" });
    expect(screen.queryByRole("textbox", { name: "name" })).toBeNull();
    expect(screen.queryByRole("button", { name: "save" })).toBeNull();
    expect(screen.getByRole("region", { name: "preview" })).toBeTruthy();
  });
});
