import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordPlan, OperationReceipt, RecordApproval } from "@/lib/persistence/generated/client";
import { AuthError } from "@/lib/auth/types";
import type { ClientDuplicateCandidate, ClientCreationPreview } from "@/modules/clients/lib/types/client.types";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), transaction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ resolveCurrentWorkspace: mocks.resolve }));
vi.mock("@/lib/persistence/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

type Plan = RecordPlan & { receipt: OperationReceipt | null; approvals: RecordApproval[] };
let plan: Plan | null;
let candidates: ClientDuplicateCandidate[];
let createdIds: string[];
let receipt: OperationReceipt | null;
let audits: unknown[];
let commitLost = false;
const tx = {
  workspace: { findFirst: vi.fn() }, session: { findFirst: vi.fn() },
  client: { findMany: vi.fn(), create: vi.fn() },
  recordPlan: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  recordApproval: { create: vi.fn() },
  operationReceipt: { create: vi.fn(), update: vi.fn() },
  auditEvent: { create: vi.fn() },
};

async function prepare(): Promise<ClientCreationPreview> {
  const { prepareClientCreation } = await import("./record-plan.services");
  const result = await prepareClientCreation({ name: " Ada ", email: " ADA@example.com ", company: " " });
  if (!result.success) throw new Error(result.error.code);
  return result.data;
}
async function confirm(preview: ClientCreationPreview, acknowledgeDuplicates = false) {
  const { confirmClientCreation } = await import("./record-plan.services");
  return confirmClientCreation({ planId: preview.planId, planHash: preview.planHash, acknowledgeDuplicates });
}

describe("shared manual client record plans", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    plan = null; candidates = []; createdIds = []; receipt = null; audits = []; commitLost = false;
    mocks.resolve.mockResolvedValue({ session: { session: { id: "session-1" }, user: { id: "actor-1", role: "trial_user" } }, workspace: { id: "workspace-1" } });
    tx.workspace.findFirst.mockResolvedValue({ id: "workspace-1" });
    tx.session.findFirst.mockResolvedValue({ id: "session-1" });
    tx.client.findMany.mockImplementation(async () => candidates);
    tx.recordPlan.create.mockImplementation(async ({ data }) => {
      plan = { ...data, id: "plan-1", planVersion: 1, status: "PREPARED", receipt: null, approvals: [] } as Plan;
      return { id: plan.id };
    });
    tx.recordPlan.findFirst.mockImplementation(async ({ where }) => plan && where.id === plan.id &&
      where.workspaceId === plan.workspaceId && where.createdByUserId === plan.createdByUserId ? plan : null);
    tx.recordPlan.update.mockImplementation(async ({ data }) => { Object.assign(plan!, data); return plan; });
    tx.recordApproval.create.mockImplementation(async ({ data }) => { plan!.approvals.push(data); return data; });
    tx.operationReceipt.create.mockImplementation(async ({ data }) => { receipt = { ...data, id: "receipt-1", outcome: "PENDING" }; plan!.receipt = receipt; return receipt; });
    tx.client.create.mockImplementation(async () => { createdIds.push("client-1"); return { id: "client-1" }; });
    tx.operationReceipt.update.mockImplementation(async ({ data }) => { Object.assign(receipt!, data); return receipt; });
    tx.auditEvent.create.mockImplementation(async ({ data }) => { audits.push(data); return { id: "audit-1" }; });
    mocks.transaction.mockImplementation(async (operation) => {
      const saved = structuredClone({ plan, receipt, createdIds, audits });
      try { const result = await operation(tx);
        if (commitLost) { commitLost = false; throw Object.assign(new Error("connection lost after commit"), { committed: true }); }
        return result;
      } catch (error) {
        if (!(error instanceof Error && "committed" in error)) {
          plan = saved.plan; receipt = saved.receipt; createdIds = saved.createdIds; audits = saved.audits;
        }
        throw error;
      }
    });
  });

  it("prepares exact normalized data with no client/receipt and safely scopes matching", async () => {
    const preview = await prepare();
    expect(preview.client).toEqual({ name: "Ada", email: "ada@example.com", phone: null, company: null, address: null, notes: null });
    expect(tx.client.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "workspace-1", OR: [{ normalizedEmail: "ada@example.com" }] } }));
    expect(tx.client.create).not.toHaveBeenCalled();
    expect(tx.operationReceipt.create).not.toHaveBeenCalled();
    expect(JSON.stringify(audits)).not.toContain("ada@example.com");
  });

  it("commits approval, manual provenance and receipt once; replay works after expiry", async () => {
    const preview = await prepare();
    expect(await confirm(preview)).toEqual({ success: true, data: { clientId: "client-1", operationId: "receipt-1", replayed: false } });
    plan!.expiresAt = new Date(0);
    expect(await confirm(preview)).toEqual({ success: true, data: { clientId: "client-1", operationId: "receipt-1", replayed: true } });
    expect(createdIds).toEqual(["client-1"]);
    expect(plan!.approvals).toHaveLength(1);
    expect(receipt).toMatchObject({ origin: "MANUAL", outcome: "SUCCEEDED", actorUserId: "actor-1", selectedClientId: "client-1" });
    expect(mocks.transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("requires explicit create-distinct decision and never updates an existing duplicate", async () => {
    candidates = [{ id: "existing-1", name: "Existing", email: "ada@example.com", phone: null, company: null, version: 1 }];
    const preview = await prepare();
    expect(await confirm(preview)).toMatchObject({ success: false, error: { code: "DUPLICATE_ACKNOWLEDGMENT_REQUIRED" } });
    expect(createdIds).toEqual([]);
    expect(await confirm(preview, true)).toMatchObject({ success: true });
    expect(plan!.duplicateDecision).toBe("CREATE_DISTINCT");
    expect(candidates[0].name).toBe("Existing");
  });

  it.each(["new-match", "version-change", "removed-match"])("invalidates approval after duplicate drift: %s", async (change) => {
    candidates = [{ id: "existing-1", name: "Existing", email: "ada@example.com", phone: null, company: null, version: 1 }];
    const preview = await prepare();
    if (change === "new-match") candidates = [...candidates, { ...candidates[0], id: "existing-2" }];
    if (change === "version-change") candidates = [{ ...candidates[0], version: 2 }];
    if (change === "removed-match") candidates = [];
    expect(await confirm(preview, true)).toMatchObject({ success: false, error: { code: "DUPLICATES_CHANGED" } });
    expect(plan!.status).toBe("INVALIDATED");
    expect(createdIds).toEqual([]);
  });

  it.each(["expired", "status", "hash", "payload", "denied-approval"])("rejects stale/invalid approval: %s", async (change) => {
    const preview = await prepare();
    if (change === "expired") plan!.expiresAt = new Date(0);
    if (change === "status") plan!.status = "INVALIDATED";
    if (change === "hash") preview.planHash = "f".repeat(64);
    if (change === "payload") plan!.normalizedPayload = { ...preview.client, name: "Tampered" };
    if (change === "denied-approval") plan!.approvals.push({ decision: "DENIED" } as RecordApproval);
    expect(await confirm(preview)).toMatchObject({ success: false, error: { code: change === "expired" ? "PLAN_EXPIRED" : "PLAN_STALE" } });
    expect(createdIds).toEqual([]);
  });

  it.each(["actor", "workspace"])("hides plans from another %s", async (change) => {
    const preview = await prepare();
    if (change === "actor") plan!.createdByUserId = "someone-else";
    else plan!.workspaceId = "another-workspace";
    expect(await confirm(preview)).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
    expect(createdIds).toEqual([]);
  });

  it.each(["workspace", "session"] as const)("rechecks %s authorization inside the transaction", async (change) => {
    const preview = await prepare();
    tx[change].findFirst.mockResolvedValue(null);
    expect(await confirm(preview)).toMatchObject({ success: false, error: { code: change === "workspace" ? "ACCOUNT_INACTIVE" : "UNAUTHENTICATED" } });
    expect(createdIds).toEqual([]);
  });

  it("rolls back client, receipt and approval if transactional audit fails", async () => {
    const preview = await prepare();
    tx.auditEvent.create.mockRejectedValueOnce(new Error("audit write failed"));
    expect(await confirm(preview)).toMatchObject({ success: false, error: { code: "CONFIRMATION_UNCERTAIN" } });
    expect(createdIds).toEqual([]); expect(receipt).toBeNull(); expect(plan!.approvals).toEqual([]);
    expect(await confirm(preview)).toMatchObject({ success: true });
    expect(createdIds).toHaveLength(1);
  });

  it("reconciles a lost commit response on the same plan", async () => {
    const preview = await prepare(); commitLost = true;
    expect(await confirm(preview)).toMatchObject({ success: false, error: { code: "CONFIRMATION_UNCERTAIN" } });
    expect(createdIds).toHaveLength(1);
    expect(await confirm(preview)).toMatchObject({ success: true, data: { replayed: true } });
    expect(createdIds).toHaveLength(1);
  });

  it.each(["P2034", "P2002"])("retries %s conflicts against the same plan and refreshed duplicate set", async (code) => {
    const preview = await prepare();
    tx.client.create.mockRejectedValueOnce({ code });
    expect(await confirm(preview)).toMatchObject({ success: true });
    expect(createdIds).toHaveLength(1);
    expect(tx.recordPlan.findFirst).toHaveBeenCalledTimes(2);
  });

  it("bounds repeated transaction conflicts and preserves the plan for reconciliation", async () => {
    const preview = await prepare();
    tx.client.create.mockRejectedValue({ code: "P2034" });
    expect(await confirm(preview)).toMatchObject({ success: false, error: { code: "CONFIRMATION_UNCERTAIN" } });
    expect(tx.recordPlan.findFirst).toHaveBeenCalledTimes(3);
    expect(createdIds).toHaveLength(0);
    expect(plan!.status).toBe("PREPARED");
  });

  it("rejects unauthenticated and sensitive submissions without storing a plan", async () => {
    const { prepareClientCreation } = await import("./record-plan.services");
    expect(await prepareClientCreation({ name: "A", email: "a@example.com", notes: "CVV: 123" })).toMatchObject({ success: false, error: { code: "SENSITIVE_DATA" } });
    mocks.resolve.mockRejectedValue(new AuthError("UNAUTHENTICATED"));
    expect(await prepareClientCreation({ name: "A", email: "a@example.com" })).toMatchObject({ success: false, error: { code: "UNAUTHENTICATED" } });
    expect(plan).toBeNull();
  });
});
