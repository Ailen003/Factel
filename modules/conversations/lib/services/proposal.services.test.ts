import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { ProposalDraft, SaveProposalRevisionInput, ValidatedExtraction } from "../types/proposal.types";
import { draftFields, validateProposalDraft } from "../validation/proposal-validation";

const mocks = vi.hoisted(() => {
  const db = {
    workspace: { findFirst: vi.fn() }, session: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn(), updateMany: vi.fn() },
    proposalRevision: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    transcriptEvidence: { findMany: vi.fn() }, proposalClientDraft: { create: vi.fn() },
    proposalRequestItem: { createMany: vi.fn() }, proposalField: { createMany: vi.fn() },
    proposalFieldEvidence: { createMany: vi.fn() }, proposalFinding: { createMany: vi.fn() },
    processingRun: { findUnique: vi.fn(), update: vi.fn() },
    creditReservation: { updateMany: vi.fn() }, creditEntry: { create: vi.fn() },
    providerInvocation: { updateMany: vi.fn() }, processingCheckpoint: { findFirst: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
    recordPlan: { updateMany: vi.fn() }, auditEvent: { create: vi.fn() },
  };
  return { db, transaction: vi.fn(), resolve: vi.fn() };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/persistence/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/auth/session", () => ({ resolveCurrentWorkspace: mocks.resolve }));

import { getConversationReview, getProposalHistory, markProposalReady, publishExtraction, saveProposalRevision } from "./proposal.services";

const conversation = () => ({ id: "conversation-1", workspaceId: "workspace-1", version: 4, status: "NEEDS_REVIEW",
  currentProposalRevisionId: "revision-1", deletionState: "ACTIVE", completedOperationId: null, correlationId: "trace-1" });
const draft = (): ProposalDraft => ({
  client: { name: "Ada", email: "ada@example.com", phone: "", company: "", address: "", notes: "" },
  requests: [{ stableItemId: "item-1", title: "Repair", description: "Repair the pump", serviceType: "repair", priority: "normal", preferredSchedule: "", serviceAddress: "", nextSteps: "" }],
});
function revision(values = draft()) {
  return { id: "revision-1", workspaceId: "workspace-1", conversationId: "conversation-1", revisionNumber: 1,
    parentRevisionId: null, producingRunId: "run-1", transcriptId: "transcript-1", diarizationVersionId: null,
    schemaVersion: "1", taskProfileVersion: "1", promptVersion: "1", policyVersion: "1", authorKind: "EXTRACTION",
    authorUser: null, readyByUser: null, createdAt: new Date("2026-09-08T12:00:00Z"), readyAt: null,
    sealedAt: new Date("2026-09-08T12:00:00Z"), validationSummary: { findings: validateProposalDraft(values) }, inputFingerprint: null as string | null,
    clientDraft: values.client, requestItems: values.requests.map((item) => ({ ...item, serviceType: item.serviceType.toUpperCase(), priority: item.priority.toUpperCase() })),
    fields: draftFields(values).map((field) => ({ target: field.target.toUpperCase(), fieldKey: field.fieldKey,
      observedValue: field.value || null, normalizedValue: field.value || null, provenance: field.value ? "EXTRACTED" : "DEFAULT", confidence: null,
      requestItem: field.itemId ? { stableItemId: field.itemId } : null,
      evidenceLinks: field.value ? [{ evidence: { stableEvidenceId: "evidence-1" } }] : [] })),
  };
}
const saveInput = (): SaveProposalRevisionInput => ({ conversationId: "conversation-1", expectedVersion: 4,
  baseRevisionId: "revision-1", operationId: "a8fd0406-915f-44c2-b744-bf0271807511", draft: draft(), resolutions: [] });
const extraction = (): ValidatedExtraction => ({
  draft: { client: { name: "", email: "", phone: "", company: "", address: "", notes: "" },
    requests: [{ stableItemId: "item-1", title: "", description: "", serviceType: "", priority: "normal", preferredSchedule: "", serviceAddress: "", nextSteps: "" }] },
  fields: [], findings: [], versions: { schema: "1", task: "1", prompt: "1", policy: "1" },
});
const run = () => ({ id: "run-1", workspaceId: "workspace-1", conversationId: "conversation-1", status: "RUNNING",
  reservation: { id: "reservation-1", quantity: 1, status: "ACTIVE" },
  workspace: { lifecycle: "ACTIVE", owner: { status: "active", banned: false, role: "trial_user" } },
  conversation: { ...conversation(), status: "VALIDATING", currentProposalRevisionId: null, currentRunId: "run-1",
    originalTranscript: { id: "transcript-1", text: "Hello", evidence: [{ stableEvidenceId: "evidence-1", startOffset: 0, endOffset: 5 }] }, diarizationVersions: [] },
});
const lease = () => ({ attempt: 1, leaseReference: "lease-1", expiresAt: new Date(Date.now() + 60000) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (work: (tx: typeof mocks.db) => Promise<unknown>) => work(mocks.db));
  mocks.resolve.mockResolvedValue({ workspace: { id: "workspace-1" }, session: { user: { id: "user-1", role: "trial_user" }, session: { id: "session-1" } } });
  mocks.db.workspace.findFirst.mockResolvedValue({ id: "workspace-1" });
  mocks.db.session.findFirst.mockResolvedValue({ id: "session-1" });
  mocks.db.conversation.findFirst.mockResolvedValue(conversation());
  mocks.db.conversation.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.creditReservation.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.proposalRevision.findFirst.mockImplementation(async ({ where }: { where: { operationKey?: string } }) => where.operationKey ? null : revision());
  mocks.db.transcriptEvidence.findMany.mockResolvedValue([{ id: "evidence-db-1", stableEvidenceId: "evidence-1" }]);
  mocks.db.processingRun.findUnique.mockResolvedValue(run());
  mocks.db.processingCheckpoint.findFirst.mockResolvedValue({ id: "checkpoint-1", updatedAt: new Date() });
});

describe("proposal publication", () => {
  it("publishes a contact-review gap with original evidence and the normal single credit settlement", async () => {
    const current = run();
    const text = "415-555-0182";
    current.conversation.originalTranscript = { id: "transcript-1", text, evidence: [{ stableEvidenceId: "evidence-1", startOffset: 0, endOffset: text.length }] };
    mocks.db.processingRun.findUnique.mockResolvedValue(current);
    const output = extraction();
    output.draft.client.phone = "+14155550182";
    output.fields.push({ target: "client", itemId: null, fieldKey: "phone", observedValue: text, normalizedValue: "+14155550182",
      evidenceIds: ["evidence-1"], provenance: "extracted", confidence: null });
    expect(await publishExtraction("run-1", output, lease())).toEqual(expect.any(String));
    expect(mocks.db.proposalClientDraft.create).toHaveBeenCalledWith({ data: expect.objectContaining({ phone: "", normalizedPhone: null }) });
    expect(mocks.db.proposalField.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([expect.objectContaining({
      fieldKey: "phone", observedValue: text, normalizedValue: null, provenance: "EXTRACTED",
    })]) });
    expect(mocks.db.proposalFinding.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([expect.objectContaining({ code: "AMBIGUITY", severity: "BLOCKING" })]) });
    expect(mocks.db.proposalFieldEvidence.createMany).toHaveBeenCalled();
    expect(mocks.db.creditEntry.create).toHaveBeenCalledTimes(1);
  });
  it("publishes an incomplete but reviewable proposal and consumes exactly one reservation; delivery replay has no writes", async () => {
    const id = await publishExtraction("run-1", extraction(), lease());
    expect(id).toEqual(expect.any(String));
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable", timeout: 20000 });
    expect(mocks.db.proposalRevision.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id, operationKey: "extraction:run-1", validationSummary: { findings: expect.arrayContaining([expect.objectContaining({ code: "MISSING_REQUIRED" })]) } }) }));
    expect(mocks.db.creditEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: "CONSUME", quantity: 1, reservationId: "reservation-1", operationKey: "processing-consume-entry:run-1" }) });
    expect(mocks.db.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "NEEDS_REVIEW", currentProposalRevisionId: id, version: { increment: 1 } } }));
    mocks.db.processingRun.findUnique.mockResolvedValue({ ...run(), status: "SUCCEEDED", reservation: { ...run().reservation, status: "CONSUMED" } });
    mocks.db.proposalRevision.findFirst.mockResolvedValue({ id });
    expect(await publishExtraction("run-1", extraction(), lease())).toBe(id);
    expect(mocks.db.proposalRevision.create).toHaveBeenCalledTimes(1);
    expect(mocks.db.creditEntry.create).toHaveBeenCalledTimes(1);
  });
  it.each(["suspended", "banned", "deleted", "superseded"])("does not publish or charge when authority is %s", async (reason) => {
    const current = run();
    if (reason === "suspended") current.workspace.owner.status = "suspended";
    if (reason === "banned") current.workspace.owner.banned = true;
    if (reason === "deleted") current.conversation.deletionState = "DELETED";
    if (reason === "superseded") current.conversation.currentRunId = "run-2";
    mocks.db.processingRun.findUnique.mockResolvedValue(current);
    expect(await publishExtraction("run-1", extraction(), lease())).toBeNull();
    expect(mocks.db.proposalRevision.create).not.toHaveBeenCalled();
    expect(mocks.db.creditEntry.create).not.toHaveBeenCalled();
  });
  it("revalidates evidence against the persisted transcript before writing", async () => {
    const output = extraction();
    output.draft.client.name = "Invented";
    output.fields = [{ target: "client", itemId: null, fieldKey: "name", normalizedValue: "Invented", observedValue: "Invented", provenance: "extracted", confidence: null, evidenceIds: ["foreign-evidence"] }];
    expect(await publishExtraction("run-1", output, lease())).toEqual(expect.any(String));
    expect(mocks.db.proposalField.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
      expect.objectContaining({ fieldKey: "name", normalizedValue: null, observedValue: null, provenance: "DEFAULT" }),
    ]) });
    expect(mocks.db.proposalFieldEvidence.createMany).not.toHaveBeenCalled();
    expect(mocks.db.proposalFinding.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
      expect.objectContaining({ code: "NONEXISTENT_EVIDENCE", severity: "BLOCKING" }),
    ]) });
    expect(mocks.db.creditEntry.create).toHaveBeenCalledTimes(1);
  });
  it("rejects an expired extraction worker without publishing or charging", async () => {
    expect(await publishExtraction("run-1", extraction(), { ...lease(), expiresAt: new Date(0) })).toBeNull();
    expect(mocks.db.proposalRevision.create).not.toHaveBeenCalled();
    expect(mocks.db.creditEntry.create).not.toHaveBeenCalled();
  });
});

describe("human proposal revisions", () => {
  it("editing a pending creation plan creates a new unready revision and invalidates every pending plan", async () => {
    mocks.db.conversation.findFirst.mockResolvedValue({ ...conversation(), status: "RECORD_PLAN_PENDING" });
    const input = saveInput();
    input.draft.requests[0].title = "Human correction after preview";
    expect(await saveProposalRevision(input)).toMatchObject({ success: true, data: { status: "needs_review", version: 5 } });
    expect(mocks.db.recordPlan.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1", sourceConversationId: "conversation-1", status: { in: ["PREPARED", "APPROVED"] } },
      data: { status: "INVALIDATED", invalidatedAt: expect.any(Date) },
    });
    expect(mocks.db.proposalRevision.create).toHaveBeenCalledWith({ data: expect.objectContaining({ authorKind: "HUMAN", parentRevisionId: "revision-1" }) });
    expect(mocks.db.creditEntry.create).not.toHaveBeenCalled();
  });
  it("a completed conversation rejects new saves and readiness while allowing historical review", async () => {
    mocks.db.conversation.findFirst.mockResolvedValue({ ...conversation(), status: "COMPLETED", completedOperationId: "receipt-1" });
    const input = saveInput(); input.draft.client.name = "Another client";
    expect(await saveProposalRevision(input)).toMatchObject({ success: false, error: { code: "INVALID_STATUS_TRANSITION" } });
    expect(await markProposalReady({ conversationId: "conversation-1", revisionId: "revision-1", expectedVersion: 4 })).toMatchObject({ success: false, error: { code: "INVALID_STATUS_TRANSITION" } });
    expect(await getConversationReview({ conversationId: "conversation-1" })).toMatchObject({ success: true, data: { status: "completed", revision: { id: "revision-1" } } });
    expect(mocks.db.proposalRevision.create).not.toHaveBeenCalled();
    expect(mocks.db.conversation.updateMany).not.toHaveBeenCalled();
  });
  it("preserves recovered request issues across saves and requires an explicit authored decision", async () => {
    const parentDraft = draft();
    parentDraft.requests[0].serviceType = "";
    const parent = revision(parentDraft);
    const findingId = "NONEXISTENT_EVIDENCE:request:item-1:serviceType";
    parent.validationSummary.findings.push({ id: findingId, code: "NONEXISTENT_EVIDENCE", target: "request", itemId: "item-1",
      fieldKey: "serviceType", severity: "blocking", resolution: null });
    mocks.db.proposalRevision.findFirst.mockImplementation(async ({ where }: { where: { operationKey?: string } }) => where.operationKey ? null : parent);
    const input = saveInput();
    // Correcting a field alone must not silently erase its evidence-review issue.
    expect(await saveProposalRevision(input)).toMatchObject({ success: true });
    expect(mocks.db.proposalRevision.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ validationSummary: {
      findings: [expect.objectContaining({ id: findingId, resolution: null })],
    } }) });
    input.resolutions = [{ findingId, reason: "Confirmed repair from the original transcript" }];
    expect(await saveProposalRevision(input)).toMatchObject({ success: true });
    expect(mocks.db.proposalRevision.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ authorKind: "HUMAN", parentRevisionId: "revision-1",
      validationSummary: { findings: [expect.objectContaining({ id: findingId, resolution: input.resolutions[0].reason })] } }) });
    expect(mocks.db.proposalField.createMany).toHaveBeenLastCalledWith({ data: expect.arrayContaining([
      expect.objectContaining({ fieldKey: "serviceType", normalizedValue: "repair", observedValue: null, provenance: "MANUAL" }),
    ]) });
    const corrected = revision();
    corrected.validationSummary.findings = [{ ...parent.validationSummary.findings.find((finding) => finding.id === findingId)!, resolution: null }];
    mocks.db.proposalRevision.findFirst.mockResolvedValue(corrected);
    expect(await markProposalReady({ conversationId: "conversation-1", expectedVersion: 4, revisionId: "revision-1" })).toMatchObject({ success: false, error: { code: "PROPOSAL_NOT_READY" } });
    corrected.validationSummary.findings[0].resolution = input.resolutions[0].reason;
    expect(await markProposalReady({ conversationId: "conversation-1", expectedVersion: 4, revisionId: "revision-1" })).toMatchObject({ success: true });
    expect(mocks.db.creditEntry.create).not.toHaveBeenCalled();
  });
  it("keeps an unresolved contact blocking even when the remaining business fields are valid", async () => {
    const parent = revision();
    parent.validationSummary.findings.push({ id: "AMBIGUITY:client:client:phone", code: "AMBIGUITY", target: "client", itemId: null,
      fieldKey: "phone", severity: "blocking", resolution: null });
    mocks.db.proposalRevision.findFirst.mockResolvedValue(parent);
    expect(await markProposalReady({ conversationId: "conversation-1", expectedVersion: 4, revisionId: "revision-1" }))
      .toMatchObject({ success: false, error: { code: "PROPOSAL_NOT_READY" } });
    expect(mocks.db.conversation.updateMany).not.toHaveBeenCalled();
  });
  it("saves the human contact correction and decision in a new revision without inventing evidence", async () => {
    const parent = revision();
    const findingId = "AMBIGUITY:client:client:phone";
    parent.validationSummary.findings.push({ id: findingId, code: "AMBIGUITY", target: "client", itemId: null,
      fieldKey: "phone", severity: "blocking", resolution: null });
    const phone = parent.fields.find((field) => field.fieldKey === "phone")!;
    phone.observedValue = "double five or six";
    phone.provenance = "EXTRACTED";
    phone.evidenceLinks = [{ evidence: { stableEvidenceId: "evidence-1" } }];
    mocks.db.proposalRevision.findFirst.mockImplementation(async ({ where }: { where: { operationKey?: string } }) => where.operationKey ? null : parent);
    const input = saveInput();
    input.draft.client.phone = "+14155550182";
    input.resolutions = [{ findingId, reason: "Confirmed directly with the caller" }];
    expect(await saveProposalRevision(input)).toMatchObject({ success: true });
    expect(mocks.db.proposalRevision.create).toHaveBeenCalledWith({ data: expect.objectContaining({ authorKind: "HUMAN", parentRevisionId: "revision-1",
      validationSummary: { findings: [expect.objectContaining({ id: findingId, resolution: "Confirmed directly with the caller" })] } }) });
    expect(mocks.db.proposalField.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([expect.objectContaining({
      fieldKey: "phone", normalizedValue: "+14155550182", observedValue: null, provenance: "MANUAL",
    })]) });
    expect(phone.observedValue).toBe("double five or six");
    expect(mocks.db.creditEntry.create).not.toHaveBeenCalled();
  });
  it("rejects stale edits without storing revisions or touching credits", async () => {
    expect(await saveProposalRevision({ ...saveInput(), expectedVersion: 3 })).toMatchObject({ success: false, error: { code: "STALE_VERSION" } });
    expect(mocks.db.proposalRevision.create).not.toHaveBeenCalled();
    expect(mocks.db.creditEntry.create).not.toHaveBeenCalled();
  });
  it("saves incomplete edits with manual provenance while preserving unchanged evidence", async () => {
    const input = saveInput();
    input.draft.client.email = "";
    input.draft.client.name = "Grace";
    expect(await saveProposalRevision(input)).toMatchObject({ success: true, data: { status: "needs_review", version: 5 } });
    expect(mocks.db.proposalRevision.create).toHaveBeenCalledWith({ data: expect.objectContaining({ authorKind: "HUMAN", authorUserId: "user-1", parentRevisionId: "revision-1", revisionNumber: 2,
      validationSummary: { findings: expect.arrayContaining([expect.objectContaining({ code: "MISSING_REQUIRED", fieldKey: "email" })]) } }) });
    expect(mocks.db.proposalField.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
      expect.objectContaining({ fieldKey: "name", normalizedValue: "Grace", observedValue: null, provenance: "MANUAL" }),
      expect.objectContaining({ fieldKey: "email", normalizedValue: null, observedValue: null, provenance: "MANUAL" }),
      expect.objectContaining({ fieldKey: "title", normalizedValue: "Repair", observedValue: "Repair", provenance: "EXTRACTED" }),
    ]) });
    expect(mocks.db.proposalFieldEvidence.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([expect.objectContaining({ evidenceId: "evidence-db-1" })]) });
    expect(mocks.db.creditEntry.create).not.toHaveBeenCalled();
  });
  it("replays the same save even after the conversation version changed", async () => {
    const input = saveInput();
    const saved = { ...revision(), inputFingerprint: createHash("sha256").update(JSON.stringify(input)).digest("hex") };
    mocks.db.proposalRevision.findFirst.mockResolvedValue(saved);
    mocks.db.conversation.findFirst.mockResolvedValue({ ...conversation(), version: 8 });
    expect(await saveProposalRevision(input)).toMatchObject({ success: true });
    expect(mocks.db.proposalRevision.create).not.toHaveBeenCalled();
  });
  it("rejects a reused operation ID with a different payload", async () => {
    mocks.db.proposalRevision.findFirst.mockResolvedValue({ ...revision(), inputFingerprint: "different-payload" });
    expect(await saveProposalRevision(saveInput())).toMatchObject({ success: false, error: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(mocks.db.proposalRevision.create).not.toHaveBeenCalled();
  });
  it("does not allow a caller to resolve objective validation errors", async () => {
    const input = saveInput();
    input.resolutions = [{ findingId: "MISSING_REQUIRED:client:client:email", reason: "Ignore" }];
    expect(await saveProposalRevision(input)).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(mocks.db.proposalRevision.create).not.toHaveBeenCalled();
  });
  it("revalidates actual fields when marking ready, even if stored findings are empty", async () => {
    const incomplete = draft(); incomplete.client.email = "";
    mocks.db.proposalRevision.findFirst.mockResolvedValue({ ...revision(incomplete), validationSummary: { findings: [] } });
    expect(await markProposalReady({ conversationId: "conversation-1", expectedVersion: 4, revisionId: "revision-1" })).toMatchObject({ success: false, error: { code: "PROPOSAL_NOT_READY" } });
    expect(mocks.db.conversation.updateMany).not.toHaveBeenCalled();
  });
  it("marks a valid current revision ready with the authenticated author", async () => {
    expect(await markProposalReady({ conversationId: "conversation-1", expectedVersion: 4, revisionId: "revision-1" })).toMatchObject({ success: true, data: { status: "ready", version: 5 } });
    expect(mocks.db.proposalRevision.update).toHaveBeenCalledWith({ where: { id: "revision-1" }, data: { status: "READY", readyAt: expect.any(Date), readyByUserId: "user-1" } });
  });
  it("returns READY replay without recording another transition", async () => {
    mocks.db.conversation.findFirst.mockResolvedValue({ ...conversation(), status: "READY", version: 5 });
    expect(await markProposalReady({ conversationId: "conversation-1", expectedVersion: 4, revisionId: "revision-1" })).toMatchObject({ success: true });
    expect(mocks.db.conversation.updateMany).not.toHaveBeenCalled();
  });
});

describe("proposal authorization", () => {
  it("scopes conversation and revision queries to the authenticated workspace", async () => {
    expect(await getConversationReview({ conversationId: "conversation-1", revisionId: "revision-1" })).toMatchObject({ success: true });
    expect(mocks.db.conversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "conversation-1", workspaceId: "workspace-1", deletionState: "ACTIVE" } }));
    expect(mocks.db.proposalRevision.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "revision-1", workspaceId: "workspace-1", conversationId: "conversation-1", sealedAt: { not: null } } }));
  });
  it("hides foreign conversations and does not query their history", async () => {
    mocks.db.conversation.findFirst.mockResolvedValue(null);
    expect(await getProposalHistory({ conversationId: "foreign-conversation" })).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
    expect(mocks.db.proposalRevision.findMany).not.toHaveBeenCalled();
  });
  it("checks account and session authority inside the transaction", async () => {
    mocks.db.session.findFirst.mockResolvedValue(null);
    expect(await saveProposalRevision(saveInput())).toMatchObject({ success: false, error: { code: "UNAUTHENTICATED" } });
    expect(mocks.db.conversation.findFirst).not.toHaveBeenCalled();
    expect(mocks.db.proposalRevision.create).not.toHaveBeenCalled();
  });
});
