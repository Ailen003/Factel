import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reconcile: vi.fn() }));
vi.mock("@/modules/conversations/lib/services/processing.services", () => ({
  reconcileConversationProcessingOutbox: mocks.reconcile,
}));

import { GET } from "./route";

describe("conversation processing reconciliation cron", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    mocks.reconcile.mockResolvedValue({ delivered: 2, deferred: 1 });
  });

  it("rejects an unauthenticated scheduler", async () => {
    const response = await GET(new Request("http://localhost/api/cron/conversation-processing"));
    expect(response.status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("runs one authenticated bounded reconciliation", async () => {
    const response = await GET(new Request("http://localhost/api/cron/conversation-processing", {
      headers: { authorization: "Bearer test-secret" },
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ delivered: 2, deferred: 1 });
    expect(mocks.reconcile).toHaveBeenCalledOnce();
  });
});
