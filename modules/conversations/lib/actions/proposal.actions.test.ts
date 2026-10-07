import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SaveProposalRevisionInput } from "../types/proposal.types";

const services = vi.hoisted(() => ({ getConversationReview: vi.fn(), getProposalHistory: vi.fn(), saveProposalRevision: vi.fn(), markProposalReady: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../services/proposal.services", () => services);
import { getConversationReviewAction, getProposalHistoryAction, markProposalReadyAction, saveProposalRevisionAction } from "./proposal.actions";

beforeEach(() => vi.resetAllMocks());
describe("proposal action boundaries", () => {
  it("rejects forged workspace authority before invoking the service", async () => {
    const input = { conversationId: "conversation-1", workspaceId: "foreign" };
    expect(await getConversationReviewAction(input)).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(services.getConversationReview).not.toHaveBeenCalled();
  });
  it("passes only the validated history cursor and preserves service failures", async () => {
    const input = { conversationId: "conversation-1", cursor: "revision-2" };
    const failure = { success: false, error: { code: "NOT_FOUND", message: "NOT_FOUND" } };
    services.getProposalHistory.mockResolvedValue(failure);
    expect(await getProposalHistoryAction(input)).toEqual(failure);
    expect(services.getProposalHistory).toHaveBeenCalledWith(input);
  });
  it("rejects duplicate stable request identities before persistence", async () => {
    const request = { stableItemId: "item-1", title: "", description: "", serviceType: "", priority: "normal", preferredSchedule: "", serviceAddress: "", nextSteps: "" } as const;
    const input: SaveProposalRevisionInput = { conversationId: "conversation-1", baseRevisionId: "revision-1", expectedVersion: 1,
      operationId: "a8fd0406-915f-44c2-b744-bf0271807511", resolutions: [], draft: {
        client: { name: "", email: "", phone: "", company: "", address: "", notes: "" }, requests: [request, request],
      } };
    expect(await saveProposalRevisionAction(input)).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(services.saveProposalRevision).not.toHaveBeenCalled();
  });
  it("delegates readiness with its optimistic version and revision identity", async () => {
    const input = { conversationId: "conversation-1", revisionId: "revision-1", expectedVersion: 3 };
    services.markProposalReady.mockResolvedValue({ success: true, data: { status: "ready" } });
    expect(await markProposalReadyAction(input)).toMatchObject({ success: true });
    expect(services.markProposalReady).toHaveBeenCalledWith(input);
    expect(await markProposalReadyAction({ ...input, expectedVersion: 0 })).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(services.markProposalReady).toHaveBeenCalledTimes(1);
  });
});
