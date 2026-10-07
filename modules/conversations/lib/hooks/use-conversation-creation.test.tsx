import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useConversationCreation from "./use-conversation-creation";
import type { ConversationCreationState } from "../types/conversation-creation.types";

const mocks = vi.hoisted(() => ({ load: vi.fn(), prepare: vi.fn(), confirm: vi.fn(), abandon: vi.fn() }));
const translate = Object.assign((key: string) => key, { has: () => true });
vi.mock("next-intl", () => ({ useTranslations: () => translate }));
vi.mock("../actions/conversation-creation.actions", () => ({ getConversationCreationStateAction: mocks.load,
  prepareConversationCreationAction: mocks.prepare, confirmConversationCreationAction: mocks.confirm, abandonConversationCreationAction: mocks.abandon }));
const ready: ConversationCreationState = { conversationId: "conversation-a", revisionId: "revision-a", version: 5, status: "ready", duplicates: [], preview: null, result: null };
const pending: ConversationCreationState = { ...ready, version: 6, status: "record_plan_pending", preview: {
  conversationId: ready.conversationId, revisionId: ready.revisionId!, version: 6, planId: "plan-a", planHash: "a".repeat(64),
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), choice: { kind: "new" }, duplicates: [], requests: [],
  client: { name: "Caller", email: null, phone: null, company: null, address: null, notes: null },
} };
const receipt = { operationId: "operation-a", conversationId: ready.conversationId, clientId: "client-a", requestIds: ["request-a", "request-b"], completedAt: "2026-09-08T12:00:00Z", replayed: false };
const success = (data: unknown) => ({ success: true, data });

function setup() {
  const onStateChange = vi.fn(); const onChanged = vi.fn();
  return { onStateChange, onChanged, ...renderHook(({ recover = false, completed = false }) => useConversationCreation({ conversationId: ready.conversationId, recover, completed, onStateChange, onChanged }), { initialProps: { recover: false, completed: false } }) };
}

describe("useConversationCreation", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.load.mockResolvedValue(success(ready)); mocks.prepare.mockResolvedValue(success(pending));
  });

  it("prepares one full persisted revision automatically only when there are no matches", async () => {
    const { result } = setup();
    await act(async () => { await Promise.all([result.current.start(), result.current.start()]); });
    expect(mocks.load).toHaveBeenCalledOnce();
    expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith({ conversationId: ready.conversationId, revisionId: ready.revisionId, expectedVersion: 5, choice: { kind: "new" } });
    expect(result.current.state).toEqual(pending);
  });

  it("waits for one explicit client choice if a duplicate exists", async () => {
    mocks.load.mockResolvedValue(success({ ...ready, duplicates: [{ id: "existing-a" }] }));
    const { result } = setup();
    await act(async () => { await result.current.start(); });
    expect(mocks.prepare).not.toHaveBeenCalled();
    await act(async () => { await result.current.prepare({ kind: "existing", clientId: "existing-a" }); });
    expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ choice: { kind: "existing", clientId: "existing-a" } }));
  });

  it("locks after a lost response, blocks competing actions and reconciles the identical attempt", async () => {
    mocks.confirm.mockRejectedValueOnce(new Error("lost response")).mockResolvedValueOnce(success(receipt));
    const { result, onChanged } = setup();
    await act(async () => { await result.current.start(); });
    await act(async () => { await Promise.all([result.current.confirm(), result.current.confirm()]); });
    expect(mocks.confirm).toHaveBeenCalledOnce(); expect(result.current.uncertain).toBe(true);
    await act(async () => { await result.current.abandon(); await result.current.prepare({ kind: "new" }); await result.current.start(); result.current.acknowledge(true); });
    expect(mocks.abandon).not.toHaveBeenCalled(); expect(mocks.prepare).toHaveBeenCalledOnce(); expect(mocks.load).toHaveBeenCalledOnce();
    onChanged.mockRejectedValueOnce(new Error("refresh failed"));
    await act(async () => { await result.current.confirm(); });
    expect(mocks.confirm.mock.calls[1][0]).toEqual(mocks.confirm.mock.calls[0][0]);
    expect(result.current.state?.result).toEqual(receipt); expect(result.current.uncertain).toBe(false); expect(result.current.error).toBeNull();
    await act(async () => { await result.current.confirm(); await result.current.start(); });
    expect(mocks.confirm).toHaveBeenCalledTimes(2);
  });

  it.each(["CLIENT_CHANGED", "PROPOSAL_NOT_READY", "STALE_VERSION", "PLAN_EXPIRED"])("unlocks and allows recovery after definitive %s rejection", async (code) => {
    mocks.confirm.mockResolvedValue({ success: false, error: { code } });
    const { result } = setup();
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.confirm(); });
    expect(result.current.uncertain).toBe(false); expect(result.current.expired).toBe(true); expect(result.current.error).toBe(`errors.${code}`);
    await act(async () => { await result.current.start(); });
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });

  it("recovers an existing plan without preparing another, then observes completion from another tab", async () => {
    mocks.load.mockResolvedValueOnce(success(pending)).mockResolvedValueOnce(success({ ...ready, version: 7, status: "completed", result: receipt }));
    const { result, rerender } = setup();
    rerender({ recover: true, completed: false });
    await waitFor(() => expect(result.current.state).toEqual(pending));
    expect(mocks.prepare).not.toHaveBeenCalled();
    rerender({ recover: true, completed: true });
    await waitFor(() => expect(result.current.state?.result).toEqual(receipt));
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });

  it("does not repeatedly retry a failed automatic receipt load", async () => {
    mocks.load.mockRejectedValue(new Error("offline"));
    const { result, rerender } = setup();
    rerender({ recover: true, completed: true });
    await waitFor(() => expect(result.current.error).toBe("errors.INTERNAL_ERROR"));
    expect(mocks.load).toHaveBeenCalledOnce();
  });

  it("clears an abandoned local plan so later external completion can be recovered", async () => {
    mocks.abandon.mockResolvedValue(success({ ...ready, version: 7 }));
    const { result, rerender } = setup();
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.abandon(); });
    expect(result.current.state).toBeNull(); expect(result.current.active).toBe(false);
    mocks.load.mockResolvedValue(success({ ...ready, version: 8, status: "completed", result: receipt }));
    rerender({ recover: true, completed: true });
    await waitFor(() => expect(result.current.state?.result).toEqual(receipt));
  });
});
