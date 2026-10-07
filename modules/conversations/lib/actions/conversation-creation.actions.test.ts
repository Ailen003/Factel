import { beforeEach, describe, expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({ getConversationCreationState: vi.fn(), prepareConversationCreation: vi.fn(), confirmConversationCreation: vi.fn(), abandonConversationCreation: vi.fn() }));
vi.mock("@/lib/records/conversation-record-plan.services", () => services);
import { getConversationCreationStateAction, prepareConversationCreationAction, confirmConversationCreationAction, abandonConversationCreationAction } from "./conversation-creation.actions";

beforeEach(() => vi.resetAllMocks());
describe("conversation creation action authority", () => {
  it("rejects workspace, draft and subset overrides before invoking persistence", async () => {
    const prepare = { conversationId: "c", revisionId: "r", expectedVersion: 1, choice: { kind: "new" } };
    for (const extra of [{ workspaceId: "foreign" }, { requests: [] }, { client: { name: "Forged" } }]) {
      expect(await prepareConversationCreationAction({ ...prepare, ...extra })).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    }
    expect(services.prepareConversationCreation).not.toHaveBeenCalled();
    expect(await getConversationCreationStateAction({ conversationId: "c", workspaceId: "foreign" })).toMatchObject({ success: false });
    expect(services.getConversationCreationState).not.toHaveBeenCalled();
  });
  it("accepts one existing-client decision with revision and optimistic version", async () => {
    const input = { conversationId: "c", revisionId: "r", expectedVersion: 4, choice: { kind: "existing", clientId: "client" } };
    const result = { success: false, error: { code: "DUPLICATES_CHANGED", message: "DUPLICATES_CHANGED" } };
    services.prepareConversationCreation.mockResolvedValue(result);
    expect(await prepareConversationCreationAction(input)).toEqual(result);
    expect(services.prepareConversationCreation).toHaveBeenCalledWith(input);
    expect(await prepareConversationCreationAction({ ...input, choice: { kind: "existing" } })).toMatchObject({ success: false });
    expect(services.prepareConversationCreation).toHaveBeenCalledTimes(1);
  });
  it("confirms only the plan identity and explicit acknowledgment; never an arbitrary payload", async () => {
    const input = { planId: "p", planHash: "a".repeat(64), acknowledgeDuplicates: false };
    services.confirmConversationCreation.mockResolvedValue({ success: true, data: { operationId: "receipt" } });
    expect(await confirmConversationCreationAction(input)).toMatchObject({ success: true });
    expect(services.confirmConversationCreation).toHaveBeenCalledWith(input);
    expect(await confirmConversationCreationAction({ ...input, requests: ["subset"] })).toMatchObject({ success: false });
    expect(await confirmConversationCreationAction({ ...input, acknowledgeDuplicates: undefined })).toMatchObject({ success: false });
    expect(services.confirmConversationCreation).toHaveBeenCalledTimes(1);
  });
  it("requires the current conversation version when abandoning", async () => {
    const input = { conversationId: "c", expectedVersion: 3 };
    services.abandonConversationCreation.mockResolvedValue({ success: true, data: { status: "ready" } });
    expect(await abandonConversationCreationAction(input)).toMatchObject({ success: true });
    expect(services.abandonConversationCreation).toHaveBeenCalledWith(input);
    expect(await abandonConversationCreationAction({ ...input, expectedVersion: 0 })).toMatchObject({ success: false });
    expect(services.abandonConversationCreation).toHaveBeenCalledTimes(1);
  });
});
