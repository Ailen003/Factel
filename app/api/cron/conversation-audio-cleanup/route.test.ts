import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reconcile: vi.fn() }));
vi.mock("@/modules/conversations/lib/services/conversation.services", () => ({
  reconcileConversationAudioCleanup: mocks.reconcile,
}));

import { GET } from "./route";

describe("conversation cleanup cron route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    mocks.reconcile.mockResolvedValue({ expiredGrants: 1, completedTasks: 2, failedTasks: 0 });
  });

  it("requires the exact bearer secret", async () => {
    const response = await GET(new Request("http://localhost/api/cron/conversation-audio-cleanup"));
    expect(response.status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("runs one bounded reconciliation for an authenticated scheduler", async () => {
    const response = await GET(new Request("http://localhost/api/cron/conversation-audio-cleanup", {
      headers: { Authorization: "Bearer test-secret" },
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      expiredGrants: 1,
      completedTasks: 2,
      failedTasks: 0,
    });
    expect(mocks.reconcile).toHaveBeenCalledOnce();
  });
});
