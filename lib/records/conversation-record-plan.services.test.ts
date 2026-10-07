import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordPlan, OperationReceipt, RecordApproval } from "@/lib/persistence/generated/client";
import type { ConversationCreationPreview, ConversationClientChoice } from "@/modules/conversations/lib/types/conversation-creation.types";
import type { ClientDuplicateCandidate } from "@/modules/clients/lib/types/client.types";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), transaction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ resolveCurrentWorkspace: mocks.resolve }));
vi.mock("@/lib/persistence/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

type Plan = RecordPlan & { approvals: RecordApproval[] };
let plans: Plan[];
let receipt: OperationReceipt | null;
let conversation: { id: string; workspaceId: string; status: string; version: number; currentProposalRevisionId: string; completedOperationId: string | null };
let duplicates: ClientDuplicateCandidate[];
let revision: ReturnType<typeof fixtureRevision>;
let createdClients: string[];
let createdRequests: string[];
let lostReply: boolean;
const tx = {
  workspace: { findFirst: vi.fn() }, session: { findFirst: vi.fn() },
  conversation: { findFirst: vi.fn(), updateMany: vi.fn() }, proposalRevision: { findFirst: vi.fn() },
  client: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() }, serviceRequest: { create: vi.fn() },
  recordPlan: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  recordApproval: { create: vi.fn() }, operationReceipt: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  auditEvent: { create: vi.fn() },
};
function fixtureRevision() {
  return { id: "revision-1", readyAt: new Date(), sealedAt: new Date(), status: "READY",
    validationSummary: { findings: [] as Array<{ severity: string; resolution: string | null }> },
    clientDraft: { name: " Ada ", email: " ADA@example.com ", phone: null, company: null, address: null, notes: null },
    requestItems: ["first-item", "second-item"].map((stableItemId) => ({ stableItemId, title: "Repair AC", description: "Inspect the unit",
      serviceType: "REPAIR", priority: "NORMAL", preferredSchedule: null, serviceAddress: null, nextSteps: null })) };
}
async function prepare(choice: ConversationClientChoice = { kind: "new" }): Promise<ConversationCreationPreview> {
  const { prepareConversationCreation } = await import("./conversation-record-plan.services");
  const response = await prepareConversationCreation({ conversationId: conversation.id, revisionId: revision.id, expectedVersion: conversation.version, choice });
  if (!response.success || !response.data.preview) throw new Error(response.success ? "Missing preview" : response.error.code);
  return response.data.preview;
}
async function confirm(preview: ConversationCreationPreview, acknowledgeDuplicates = false) {
  const { confirmConversationCreation } = await import("./conversation-record-plan.services");
  return confirmConversationCreation({ planId: preview.planId, planHash: preview.planHash, acknowledgeDuplicates });
}

describe("conversation record batches", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    plans = []; receipt = null; duplicates = []; revision = fixtureRevision(); createdClients = []; createdRequests = []; lostReply = false;
    conversation = { id: "conversation-1", workspaceId: "workspace-1", status: "READY", version: 4,
      currentProposalRevisionId: "revision-1", completedOperationId: null };
    mocks.resolve.mockResolvedValue({ session: { session: { id: "session-1" }, user: { id: "actor-1", role: "trial_user" } }, workspace: { id: "workspace-1" } });
    tx.workspace.findFirst.mockResolvedValue({ id: "workspace-1" }); tx.session.findFirst.mockResolvedValue({ id: "session-1" });
    tx.conversation.findFirst.mockImplementation(async ({ where }) => where.id === conversation.id && where.workspaceId === conversation.workspaceId ? { ...conversation } : null);
    tx.conversation.updateMany.mockImplementation(async ({ where, data }) => {
      if (where.version !== conversation.version) return { count: 0 };
      const { version, ...rest } = data;
      Object.assign(conversation, rest, { version: conversation.version + version.increment });
      return { count: 1 };
    });
    tx.proposalRevision.findFirst.mockImplementation(async () => revision);
    tx.client.findMany.mockImplementation(async () => duplicates);
    tx.client.findFirst.mockImplementation(async ({ where }) => {
      const candidate = duplicates.find((client) => client.id === where.id);
      return candidate ? { ...candidate, address: "Saved address", notes: "Saved notes" } : null;
    });
    tx.recordPlan.create.mockImplementation(async ({ data }) => {
      const plan = { ...data, id: `plan-${plans.length + 1}`, status: "PREPARED", planVersion: 1, approvals: [] } as Plan;
      plans.push(plan); return plan;
    });
    tx.recordPlan.findFirst.mockImplementation(async ({ where }) => [...plans].reverse().find((plan) =>
      plan.workspaceId === where.workspaceId && plan.createdByUserId === where.createdByUserId &&
      (where.id ? plan.id === where.id : plan.status === where.status && plan.sourceConversationId === where.sourceConversationId)) ?? null);
    tx.recordPlan.update.mockImplementation(async ({ where, data }) => { const plan = plans.find((item) => item.id === where.id)!; Object.assign(plan, data); return plan; });
    tx.recordPlan.updateMany.mockImplementation(async ({ where, data }) => {
      for (const plan of plans) if (where.status.in.includes(plan.status) && plan.id !== where.id?.not) Object.assign(plan, data);
      return { count: 1 };
    });
    tx.operationReceipt.findFirst.mockImplementation(async ({ where }) => receipt && receipt.workspaceId === where.workspaceId && receipt.actorUserId === where.actorUserId ? receipt : null);
    tx.operationReceipt.create.mockImplementation(async ({ data }) => { receipt = { ...data, id: "receipt-1", outcome: "PENDING" }; return receipt; });
    tx.operationReceipt.update.mockImplementation(async ({ data }) => { Object.assign(receipt!, data); return receipt; });
    tx.recordApproval.create.mockImplementation(async ({ data }) => { plans.find((plan) => plan.id === data.planId)!.approvals.push(data); return data; });
    tx.client.create.mockImplementation(async () => { createdClients.push("client-1"); return { id: "client-1" }; });
    tx.serviceRequest.create.mockImplementation(async () => { const id = `request-${createdRequests.length + 1}`; createdRequests.push(id); return { id }; });
    tx.auditEvent.create.mockResolvedValue({ id: "audit-1" });
    mocks.transaction.mockImplementation(async (operation) => {
      const saved = structuredClone({ plans, receipt, conversation, createdClients, createdRequests });
      try {
        const result = await operation(tx);
        if (lostReply) { lostReply = false; throw Object.assign(new Error("Lost response"), { committed: true }); }
        return result;
      } catch (error) {
        if (!(error instanceof Error && "committed" in error)) ({ plans, receipt, conversation, createdClients, createdRequests } = saved);
        throw error;
      }
    });
  });

  it("derives the full ordered batch from the sealed revision and creates nothing on prepare", async () => {
    const preview = await prepare();
    expect(preview.client.name).toBe("Ada"); expect(preview.client.email).toBe("ada@example.com");
    expect(preview.requests.map((item) => item.stableItemId)).toEqual(["first-item", "second-item"]);
    expect(preview.requests.every((item) => item.status === "pending")).toBe(true);
    expect(conversation).toMatchObject({ version: 5, status: "RECORD_PLAN_PENDING" });
    expect(tx.client.create).not.toHaveBeenCalled(); expect(tx.operationReceipt.create).not.toHaveBeenCalled();
    expect(tx.client.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "workspace-1", OR: [{ normalizedEmail: "ada@example.com" }] } }));
  });

  it("commits all requests with provenance and reconciles from another plan after expiry", async () => {
    const first = await prepare(); const latest = await prepare();
    expect(plans[0].status).toBe("INVALIDATED");
    expect(await confirm(latest)).toMatchObject({ success: true, data: { requestIds: ["request-1", "request-2"], clientId: "client-1", replayed: false } });
    expect(receipt).toMatchObject({ origin: "CONVERSATION", idempotencyKey: "conversation-batch:workspace-1:conversation-1", sourceRevisionId: "revision-1" });
    expect(tx.serviceRequest.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ sourceProposalItemId: "first-item", status: "PENDING" }) }));
    plans[0].expiresAt = new Date(0); plans[0].normalizedPayload = null; receipt!.selectedClientId = null;
    expect(await confirm(first)).toMatchObject({ success: true, data: { replayed: true, clientId: null, requestIds: ["request-1", "request-2"] } });
    expect(createdClients).toHaveLength(1); expect(createdRequests).toHaveLength(2);
    expect(conversation).toMatchObject({ status: "COMPLETED", completedOperationId: "receipt-1" });
  });

  it("reuses a matching client's saved fields unchanged for the whole batch", async () => {
    duplicates = [{ id: "existing-1", name: "Saved name", email: "ada@example.com", phone: null, company: null, version: 3 }];
    const preview = await prepare({ kind: "existing", clientId: "existing-1" });
    expect(preview.client).toMatchObject({ name: "Saved name", address: "Saved address", notes: "Saved notes" });
    expect(await confirm(preview)).toMatchObject({ success: true, data: { clientId: "existing-1" } });
    expect(tx.client.create).not.toHaveBeenCalled();
    for (const [input] of tx.serviceRequest.create.mock.calls) expect(input.data.clientId).toBe("existing-1");
  });

  it("reconciles a committed receipt after source deletion purges the preview", async () => {
    const preview = await prepare();
    expect(await confirm(preview)).toMatchObject({ success: true });
    plans[0].normalizedPayload = {}; plans[0].sourceRevisionId = null;
    tx.conversation.findFirst.mockResolvedValue(null);
    expect(await confirm(preview)).toMatchObject({ success: true, data: { replayed: true, operationId: "receipt-1" } });
    expect(createdClients).toHaveLength(1); expect(createdRequests).toHaveLength(2);
  });

  it("requires duplicate acknowledgement for a distinct new client", async () => {
    duplicates = [{ id: "existing-1", name: "Saved", email: "ada@example.com", phone: null, company: null, version: 1 }];
    const preview = await prepare();
    expect(await confirm(preview)).toMatchObject({ success: false, error: { code: "DUPLICATE_ACKNOWLEDGMENT_REQUIRED" } });
    expect(plans[0].status).toBe("PREPARED"); expect(createdClients).toHaveLength(0);
    expect(await confirm(preview, true)).toMatchObject({ success: true });
  });

  it("rejects new duplicates and changed clients after the exact preview", async () => {
    const preview = await prepare();
    duplicates = [{ id: "new-match", name: "New match", email: "ada@example.com", phone: null, company: null, version: 1 }];
    expect(await confirm(preview)).toMatchObject({ success: false, error: { code: "DUPLICATES_CHANGED" } });
    const replacement = await prepare({ kind: "existing", clientId: "new-match" });
    tx.client.findFirst.mockResolvedValue({ ...duplicates[0], address: "Changed address", notes: "Saved notes" });
    expect(await confirm(replacement)).toMatchObject({ success: false, error: { code: "CLIENT_CHANGED" } });
    expect(tx.operationReceipt.create).not.toHaveBeenCalled();
  });

  it("rolls back the client, approval and first request when the second request fails", async () => {
    const preview = await prepare();
    tx.serviceRequest.create.mockImplementationOnce(async () => { createdRequests.push("first"); return { id: "first" }; }).mockRejectedValueOnce(new Error("Failed write"));
    expect(await confirm(preview)).toMatchObject({ success: false, error: { code: "CONFIRMATION_UNCERTAIN" } });
    expect(createdClients).toEqual([]); expect(createdRequests).toEqual([]); expect(receipt).toBeNull();
    expect(plans[0].approvals).toEqual([]); expect(conversation.status).toBe("RECORD_PLAN_PENDING");
    expect(await confirm(preview)).toMatchObject({ success: true });
  });

  it("recovers a committed lost response by reloading and confirming the same intent", async () => {
    const preview = await prepare(); lostReply = true;
    expect(await confirm(preview)).toMatchObject({ success: false, error: { code: "CONFIRMATION_UNCERTAIN" } });
    const { getConversationCreationState } = await import("./conversation-record-plan.services");
    expect(await getConversationCreationState({ conversationId: conversation.id })).toMatchObject({ success: true, data: { result: { replayed: true }, status: "completed" } });
    expect(await confirm(preview)).toMatchObject({ success: true, data: { replayed: true } });
    expect(createdRequests).toHaveLength(2);
  });

  it("retains expired previews on reload until confirmation requires a new review", async () => {
    vi.useFakeTimers();
    try {
      const preview = await prepare(); vi.advanceTimersByTime(16 * 60 * 1000);
      const { getConversationCreationState } = await import("./conversation-record-plan.services");
      expect(await getConversationCreationState({ conversationId: conversation.id })).toMatchObject({ success: true, data: { preview: { planId: preview.planId } } });
      expect(await confirm(preview)).toMatchObject({ success: false, error: { code: "PLAN_EXPIRED" } });
      expect(tx.operationReceipt.create).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("abandons a pending plan and blocks stale version, unready or foreign conversations", async () => {
    const preview = await prepare();
    const { abandonConversationCreation, prepareConversationCreation } = await import("./conversation-record-plan.services");
    expect(await abandonConversationCreation({ conversationId: conversation.id, expectedVersion: 4 })).toMatchObject({ success: false, error: { code: "STALE_VERSION" } });
    expect(await abandonConversationCreation({ conversationId: conversation.id, expectedVersion: preview.version })).toMatchObject({ success: true, data: { status: "ready", preview: null } });
    const input = { conversationId: conversation.id, revisionId: revision.id, expectedVersion: conversation.version, choice: { kind: "new" as const } };
    revision.validationSummary.findings = [{ severity: "blocking", resolution: null }];
    expect(await prepareConversationCreation(input)).toMatchObject({ success: false, error: { code: "PROPOSAL_NOT_READY" } });
    expect(await prepareConversationCreation({ ...input, conversationId: "foreign" })).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
  });

  it("rejects payload tampering and retries serialization failures with the same plan", async () => {
    const preview = await prepare();
    const original = plans[0].normalizedPayload;
    plans[0].normalizedPayload = { ...(original as object), requests: [] };
    expect(await confirm(preview)).toMatchObject({ success: false, error: { code: "PLAN_STALE" } });
    const replacement = await prepare();
    tx.operationReceipt.create.mockRejectedValueOnce({ code: "P2034" });
    expect(await confirm(replacement)).toMatchObject({ success: true });
    expect(createdClients).toHaveLength(1); expect(createdRequests).toHaveLength(2);
  });
});
