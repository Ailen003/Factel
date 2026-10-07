import assert from "node:assert/strict";
import type { Client as PgClient } from "pg";
import { prisma } from "../lib/persistence/prisma";
import {
  getConversationCreationState, prepareConversationCreation, abandonConversationCreation, confirmConversationCreation,
} from "../lib/records/conversation-record-plan.services";
import { deleteConversationProposals } from "../modules/conversations/lib/services/proposal-cleanup.services";
import { getAllClients, deleteClient } from "../modules/clients/lib/services/client.services";
import { getAllServiceRequests, deleteServiceRequest } from "../modules/requests/lib/services/service-request.services";
import type { ServiceResponse } from "../lib/api-responses";
import type { ConversationCreationPreview, ConversationClientChoice } from "../modules/conversations/lib/types/conversation-creation.types";

const actor = "integration-user";
const workspaceId = `${actor}-workspace`;
function success<T>(result: ServiceResponse<T>): T {
  if (!result.success) throw new Error(`Unexpected service failure: ${result.error.code}`);
  return result.data;
}
function failure(result: ServiceResponse<unknown>, codes?: string[]) {
  assert.equal(result.success, false, "Operation must reject stale or unauthorized state");
  if (!result.success && codes) assert(codes.includes(result.error.code), `Unexpected failure code: ${result.error.code}`);
}
function confirmation(plan: ConversationCreationPreview) {
  return { planId: plan.planId, planHash: plan.planHash, acknowledgeDuplicates: true };
}
async function fixture(id: string, email = `${id}@example.com`) {
  await prisma.conversation.create({ data: { id, workspaceId, sourceType: "UPLOAD", locale: "en", correlationId: id } });
  await prisma.processingRun.create({ data: { id: `run-${id}`, workspaceId, conversationId: id, idempotencyKey: `run-${id}`, correlationId: id } });
  await prisma.originalTranscript.create({ data: { id: `transcript-${id}`, workspaceId, conversationId: id,
    processingRunId: `run-${id}`, text: "Synthetic integration conversation", language: "en", finalizedAt: new Date(), contentFingerprint: id } });
  const revisionId = `revision-${id}`;
  await prisma.proposalRevision.create({ data: { id: revisionId, workspaceId, conversationId: id,
    revisionNumber: 1, transcriptId: `transcript-${id}`, schemaVersion: "1", taskProfileVersion: "1", promptVersion: "1",
    policyVersion: "1", authorKind: "HUMAN", authorUserId: actor, validationSummary: { findings: [] } } });
  await prisma.proposalClientDraft.create({ data: { workspaceId, revisionId, stableItemId: "client", name: "Proposed name", email,
    normalizedEmail: email, company: "Proposed company", address: "Proposed address", notes: "Proposed notes" } });
  await prisma.proposalRequestItem.createMany({ data: [0, 1].map((index) => ({ workspaceId, revisionId,
    stableItemId: `request-${index + 1}`, displayOrder: index, title: `${id} request ${index + 1}`,
    description: `Synthetic service task ${index + 1}`, serviceType: "REPAIR" as const, priority: "NORMAL" as const,
    preferredSchedule: "Morning", serviceAddress: "Service address", nextSteps: "Call client" })) });
  await prisma.proposalRevision.update({ where: { id: revisionId }, data: { sealedAt: new Date(), status: "READY", readyAt: new Date(), readyByUserId: actor } });
  await prisma.conversation.update({ where: { id }, data: { status: "READY", currentProposalRevisionId: revisionId } });
  return id;
}
async function prepare(id: string, choice: ConversationClientChoice = { kind: "new" }) {
  const state = success(await getConversationCreationState({ conversationId: id }));
  assert(state.revisionId);
  const prepared = success(await prepareConversationCreation({ conversationId: id, revisionId: state.revisionId,
    expectedVersion: state.version, choice }));
  assert(prepared.preview, "Prepared state must contain exact preview");
  return prepared.preview;
}
async function existingClient(id: string, email: string) {
  await prisma.operationReceipt.create({ data: { id: `receipt-${id}`, workspaceId, operationIntent: `intent-${id}`,
    idempotencyKey: `key-${id}`, origin: "MANUAL", outcome: "SUCCEEDED", actorUserId: actor, completedAt: new Date() } });
  return prisma.client.create({ data: { id, workspaceId, name: "Saved name", email, normalizedEmail: email,
    company: "Saved company", address: "Saved address", notes: "Saved notes", creationOperationId: `receipt-${id}`,
    createdByUserId: actor, updatedByUserId: actor } });
}

export async function verifyConversationCreation(db: PgClient) {
  let checks = 0;
  async function check(label: string, work: () => Promise<void>) {
    try { await work(); checks++; console.log(`PASS ${label}`); }
    catch (error) {
      console.error(`FAIL ${label}`);
      if (error instanceof Error && error.message.startsWith("Unexpected service failure:")) console.error(error.message);
      throw error;
    }
  }
  try {
    for (const id of [actor, "foreign-user"]) {
      await prisma.user.create({ data: { id, email: `${id}@example.com`, name: "Integration" } });
      await prisma.workspace.create({ data: { id: `${id}-workspace`, ownerId: id } });
      await prisma.session.create({ data: { id: `${id}-session`, userId: id, token: `${id}-token`, expiresAt: new Date(Date.now() + 3600000) } });
      await prisma.account.create({ data: { userId: id, accountId: id, providerId: "credential", password: "synthetic-test-hash" } });
    }
    await prisma.creditEntry.create({ data: { workspaceId, kind: "GRANT", quantity: 10, operationKey: "integration-credit-grant" } });
    const creditsBefore = await prisma.creditEntry.findMany();
    let createdPlan: ConversationCreationPreview;
    let createdOperationId = "";
    await check("new client and full two-request batch commit with provenance and receipt", async () => {
      createdPlan = await prepare(await fixture("new-client"));
      assert.equal(createdPlan.requests.length, 2);
      assert.deepEqual(createdPlan.requests.map((item) => item.stableItemId), ["request-1", "request-2"]);
      const result = success(await confirmConversationCreation(confirmation(createdPlan)));
      createdOperationId = result.operationId;
      assert.equal(result.requestIds.length, 2);
      const requests = await prisma.serviceRequest.findMany({ where: { creationOperationId: result.operationId } });
      assert.equal(requests.length, 2);
      assert(requests.every((item) => item.clientId === result.clientId && item.status === "PENDING"));
      assert.deepEqual(requests.map((item) => item.sourceProposalItemId).sort(), ["request-1", "request-2"]);
      const receipt = await prisma.operationReceipt.findUniqueOrThrow({ where: { id: result.operationId } });
      assert.equal(receipt.origin, "CONVERSATION"); assert.equal(receipt.sourceRevisionId, "revision-new-client");
      assert.equal(receipt.actorUserId, actor); assert.equal(receipt.outcome, "SUCCEEDED");
      assert.equal((await prisma.conversation.findUniqueOrThrow({ where: { id: "new-client" } })).completedOperationId, receipt.id);
      assert.equal(await prisma.recordApproval.count({ where: { planId: createdPlan.planId } }), 1);
    });
    await check("lost response is replayed after expiry and completed state survives reopening", async () => {
      await prisma.recordPlan.update({ where: { id: createdPlan.planId }, data: { expiresAt: new Date(0) } });
      const replay = success(await confirmConversationCreation(confirmation(createdPlan)));
      assert.equal(replay.operationId, createdOperationId); assert.equal(replay.replayed, true);
      const state = success(await getConversationCreationState({ conversationId: "new-client" }));
      assert.equal(state.result?.operationId, createdOperationId);
      assert.equal(await prisma.operationReceipt.count({ where: { sourceConversationId: "new-client" } }), 1);
    });
    await check("existing client is reused without changing saved contact or other fields", async () => {
      const saved = await existingClient("saved-client", "reuse@example.com");
      const plan = await prepare(await fixture("reuse-client", saved.email!), { kind: "existing", clientId: saved.id });
      assert.equal(plan.client.name, saved.name); assert.equal(plan.client.notes, saved.notes);
      const result = success(await confirmConversationCreation(confirmation(plan)));
      assert.equal(result.clientId, saved.id);
      assert.deepEqual(await prisma.client.findUniqueOrThrow({ where: { id: saved.id } }), saved);
    });
    await check("database failure on second request rolls back client, first request, approval and receipt", async () => {
      const plan = await prepare(await fixture("rollback-batch"));
      const clientCount = await prisma.client.count();
      await db.query(`CREATE FUNCTION integration_fail_second_request() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.title = 'rollback-batch request 2' THEN RAISE EXCEPTION 'integration forced rollback'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER integration_fail_second_request BEFORE INSERT ON service_requests FOR EACH ROW EXECUTE FUNCTION integration_fail_second_request()`);
      try { failure(await confirmConversationCreation(confirmation(plan))); }
      finally { await db.query("DROP TRIGGER integration_fail_second_request ON service_requests; DROP FUNCTION integration_fail_second_request()"); }
      assert.equal(await prisma.client.count(), clientCount);
      assert.equal(await prisma.serviceRequest.count({ where: { title: { startsWith: "rollback-batch" } } }), 0);
      assert.equal(await prisma.recordApproval.count({ where: { planId: plan.planId } }), 0);
      assert.equal(await prisma.operationReceipt.count({ where: { sourceConversationId: "rollback-batch" } }), 0);
      assert.equal((await prisma.conversation.findUniqueOrThrow({ where: { id: "rollback-batch" } })).status, "RECORD_PLAN_PENDING");
      assert.equal(success(await confirmConversationCreation(confirmation(plan))).requestIds.length, 2);
    });
    await check("concurrent same-plan confirmations and an older plan produce one successful batch", async () => {
      const oldPlan = await prepare(await fixture("concurrent-batch"));
      const currentPlan = await prepare("concurrent-batch");
      assert.notEqual(currentPlan.planId, oldPlan.planId);
      const outcomes = await Promise.all([confirmConversationCreation(confirmation(oldPlan)),
        confirmConversationCreation(confirmation(currentPlan)), confirmConversationCreation(confirmation(currentPlan))]);
      assert(outcomes.some((outcome) => outcome.success));
      const receipts = await prisma.operationReceipt.findMany({ where: { sourceConversationId: "concurrent-batch" } });
      assert.equal(receipts.length, 1);
      assert.equal(await prisma.serviceRequest.count({ where: { creationOperationId: receipts[0].id } }), 2);
      for (const outcome of outcomes) if (outcome.success) assert.equal(outcome.data.operationId, receipts[0].id);
      assert.equal(success(await confirmConversationCreation(confirmation(oldPlan))).operationId, receipts[0].id);
    });
    await check("stale revision invalidates confirmation", async () => {
      const plan = await prepare(await fixture("stale-revision"));
      await prisma.conversation.update({ where: { id: "stale-revision" }, data: { version: { increment: 1 }, status: "NEEDS_REVIEW" } });
      failure(await confirmConversationCreation(confirmation(plan)));
      assert.equal(await prisma.operationReceipt.count({ where: { sourceConversationId: "stale-revision" } }), 0);
    });
    await check("saved client changes require a fresh preview", async () => {
      const saved = await existingClient("stale-client", "stale@example.com");
      const plan = await prepare(await fixture("stale-client-conversation", saved.email!), { kind: "existing", clientId: saved.id });
      await prisma.client.update({ where: { id: saved.id }, data: { version: { increment: 1 }, name: "Changed saved name" } });
      failure(await confirmConversationCreation(confirmation(plan)));
    });
    await check("newly appearing duplicate invalidates prepared no-match plan", async () => {
      const plan = await prepare(await fixture("new-duplicate", "appearing@example.com"));
      await existingClient("appearing-client", "appearing@example.com");
      failure(await confirmConversationCreation(confirmation(plan)));
      assert.equal(await prisma.operationReceipt.count({ where: { sourceConversationId: "new-duplicate" } }), 0);
    });
    await check("distinct creation requires explicit duplicate acknowledgement", async () => {
      const plan = await prepare(await fixture("distinct-client", "reuse@example.com"));
      failure(await confirmConversationCreation({ ...confirmation(plan), acknowledgeDuplicates: false }));
      const result = success(await confirmConversationCreation(confirmation(plan)));
      assert.notEqual(result.clientId, "saved-client");
    });
    await check("foreign workspace cannot read, prepare, abandon or confirm", async () => {
      const plan = await prepare(await fixture("isolated-client"));
      process.env.CONVERSATION_VERIFY_ACTOR = "foreign-user";
      try {
        failure(await getConversationCreationState({ conversationId: "isolated-client" }), ["NOT_FOUND"]);
        failure(await prepareConversationCreation({ conversationId: "isolated-client", revisionId: plan.revisionId, expectedVersion: plan.version, choice: { kind: "new" } }));
        failure(await abandonConversationCreation({ conversationId: "isolated-client", expectedVersion: plan.version }));
        failure(await confirmConversationCreation(confirmation(plan)), ["NOT_FOUND"]);
      } finally { delete process.env.CONVERSATION_VERIFY_ACTOR; }
    });
    await check("abandon invalidates preview and permits preparing again", async () => {
      const plan = await prepare(await fixture("abandon-client"));
      success(await abandonConversationCreation({ conversationId: "abandon-client", expectedVersion: plan.version }));
      failure(await confirmConversationCreation(confirmation(plan)));
      assert.equal(success(await getConversationCreationState({ conversationId: "abandon-client" })).status, "ready");
      assert.notEqual((await prepare("abandon-client")).planId, plan.planId);
    });
    await check("conversation proposal cleanup preserves independent records and receipt", async () => {
      await prisma.$transaction(async (tx) => {
        await tx.conversation.update({ where: { id: "new-client" }, data: { deletionState: "DELETE_REQUESTED" } });
        await deleteConversationProposals(tx, workspaceId, "new-client");
      });
      const receipt = await prisma.operationReceipt.findUniqueOrThrow({ where: { id: createdOperationId } });
      assert.equal(receipt.sourceDeleted, true); assert.equal(receipt.sourceRevisionId, null);
      assert.equal(await prisma.serviceRequest.count({ where: { creationOperationId: receipt.id } }), 2);
      assert.equal(await prisma.proposalRevision.count({ where: { conversationId: "new-client" } }), 0);
      const plan = await prisma.recordPlan.findUniqueOrThrow({ where: { id: createdPlan.planId } });
      assert.deepEqual(plan.normalizedPayload, {});
      const recovered = success(await confirmConversationCreation(confirmation(createdPlan)));
      assert.equal(recovered.operationId, createdOperationId);
      assert.equal(recovered.replayed, true);
    });
    await check("manual lists expose the batch and later record deletion never reopens creation", async () => {
      const plan = await prepare(await fixture("manual-management"));
      const result = success(await confirmConversationCreation(confirmation(plan)));
      assert(result.clientId);
      const clients = success(await getAllClients({ search: "manual-management@example.com", page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" }));
      assert(clients.clients.some((client) => client.id === result.clientId));
      const requests = success(await getAllServiceRequests({ clientId: result.clientId, page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" }));
      assert.equal(requests.requests.length, 2);
      for (const request of requests.requests) success(await deleteServiceRequest({ id: request.id, expectedVersion: request.version }));
      const client = await prisma.client.findUniqueOrThrow({ where: { id: result.clientId } });
      success(await deleteClient({ id: client.id, expectedVersion: client.version }));
      const replay = success(await confirmConversationCreation(confirmation(plan)));
      assert.equal(replay.operationId, result.operationId);
      assert.equal(replay.clientId, null);
      assert.deepEqual(replay.requestIds, result.requestIds);
      const state = success(await getConversationCreationState({ conversationId: "manual-management" }));
      assert.equal(state.status, "completed");
      assert.equal(state.result?.operationId, result.operationId);
      assert.equal(await prisma.serviceRequest.count({ where: { creationOperationId: result.operationId } }), 0);
    });
    await check("creation, failures and replay leave all credits unchanged", async () => {
      assert.deepEqual(await prisma.creditEntry.findMany(), creditsBefore);
      assert.equal(await prisma.creditReservation.count(), 0);
    });
    console.log(`PASS ${checks} production-service PostgreSQL checks`);
  } finally { await prisma.$disconnect(); }
}

