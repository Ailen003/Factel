import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Client as PgClient } from "pg";
import { prisma } from "../lib/persistence/prisma";
import type { ServiceResponse } from "../lib/api-responses";
import { startConversationReprocessing } from "../modules/conversations/lib/services/processing.services";
import { getConversationReview, markProposalReady, publishExtraction, resolveReprocessingCandidate, saveProposalRevision } from "../modules/conversations/lib/services/proposal.services";
import { failConversationProcessingStep } from "../lib/workflow/conversation-transcription.workflow";
import { getConversationCreationState, prepareConversationCreation, confirmConversationCreation } from "../lib/records/conversation-record-plan.services";
import { deleteConversationProposals } from "../modules/conversations/lib/services/proposal-cleanup.services";
import { draftFields } from "../modules/conversations/lib/validation/proposal-validation";
import { requestFieldKeys, type ConversationReview, type ProposalDraft, type ResolveReprocessingCandidateInput, type ValidatedExtraction } from "../modules/conversations/lib/types/proposal.types";

const actor = "integration-user";
const workspaceId = `${actor}-workspace`;
const transcriptText = "Ada ada@example.com +14155550182 Repair Repair the pump Inspection Inspect the roof repair inspection normal";
function success<T>(result: ServiceResponse<T>): T {
  if (!result.success) throw new Error(`Unexpected service failure: ${result.error.code}`);
  return result.data;
}
function failure(result: ServiceResponse<unknown>, codes?: string[]) {
  assert.equal(result.success, false, "Operation must reject unauthorized or stale state");
  if (!result.success && codes) assert(codes.includes(result.error.code), `Unexpected failure code: ${result.error.code}`);
}
const review = async (conversationId: string) => success(await getConversationReview({ conversationId }));
function draft(): ProposalDraft {
  return { client: { name: "Ada", email: "ada@example.com", phone: "+14155550182", company: "", address: "", notes: "" }, requests: [
    { stableItemId: "candidate-repair", title: "Repair", description: "Repair the pump", serviceType: "repair", priority: "normal", preferredSchedule: "", serviceAddress: "", nextSteps: "" },
    { stableItemId: "candidate-inspection", title: "Inspection", description: "Inspect the roof", serviceType: "inspection", priority: "normal", preferredSchedule: "", serviceAddress: "", nextSteps: "" },
  ] };
}
function extraction(): ValidatedExtraction {
  const values = draft();
  return { draft: values, findings: [], versions: { schema: "1", task: "1", prompt: "1", policy: "1" },
    fields: draftFields(values).map((field) => ({ target: field.target, itemId: field.itemId, fieldKey: field.fieldKey,
      observedValue: field.value || null, normalizedValue: field.value || null, provenance: field.value ? "extracted" : "default",
      evidenceIds: field.value ? ["evidence-1"] : [], confidence: field.value ? 0.9 : null })) };
}
async function fixture(id: string) {
  await prisma.conversation.create({ data: { id, workspaceId, sourceType: "UPLOAD", locale: "en", correlationId: id } });
  await prisma.audioArtifact.create({ data: { workspaceId, conversationId: id, storageKey: `synthetic/${id}`,
    verificationState: "VERIFIED", verifiedMimeType: "audio/wav", verifiedContainer: "wav", byteSize: 1000, durationMs: 1000 } });
  await prisma.processingRun.create({ data: { id: `run-${id}`, workspaceId, conversationId: id, idempotencyKey: `run-${id}`,
    status: "SUCCEEDED", stage: "PUBLISHING", correlationId: id, finishedAt: new Date() } });
  await prisma.originalTranscript.create({ data: { id: `transcript-${id}`, workspaceId, conversationId: id, processingRunId: `run-${id}`,
    text: transcriptText, language: "en", finalizedAt: new Date(), contentFingerprint: id } });
  await prisma.transcriptEvidence.create({ data: { workspaceId, transcriptId: `transcript-${id}`, stableEvidenceId: "evidence-1",
    startOffset: 0, endOffset: transcriptText.length } });
  const revisionId = `revision-${id}`;
  await prisma.proposalRevision.create({ data: { id: revisionId, workspaceId, conversationId: id, revisionNumber: 1,
    transcriptId: `transcript-${id}`, schemaVersion: "1", taskProfileVersion: "1", promptVersion: "1", policyVersion: "1",
    authorKind: "HUMAN", authorUserId: actor, validationSummary: { findings: [] } } });
  await prisma.proposalClientDraft.create({ data: { workspaceId, revisionId, stableItemId: "client", name: "Ada", email: `${id}@example.com`,
    normalizedEmail: `${id}@example.com`, phone: "+14155550999", normalizedPhone: "+14155550999", notes: "Human correction" } });
  await prisma.proposalRequestItem.create({ data: { id: `item-${id}`, workspaceId, revisionId, stableItemId: "human-request", displayOrder: 0,
    title: "Human title", description: "Human corrected description", serviceType: "REPAIR", priority: "NORMAL" } });
  await prisma.proposalField.createMany({ data: [
    { workspaceId, revisionId, target: "CLIENT", fieldKey: "phone", observedValue: "+14155550999", normalizedValue: "+14155550999", provenance: "MANUAL" },
    { workspaceId, revisionId, target: "REQUEST", requestItemId: `item-${id}`, fieldKey: "description", observedValue: "Human corrected description", normalizedValue: "Human corrected description", provenance: "MANUAL" },
  ] });
  await prisma.proposalRevision.update({ where: { id: revisionId }, data: { sealedAt: new Date(), status: "READY", readyAt: new Date(), readyByUserId: actor } });
  await prisma.conversation.update({ where: { id }, data: { status: "READY", currentProposalRevisionId: revisionId, currentRunId: `run-${id}` } });
  return review(id);
}
async function prepare(conversationId: string) {
  const state = success(await getConversationCreationState({ conversationId }));
  assert(state.revisionId);
  const result = success(await prepareConversationCreation({ conversationId, revisionId: state.revisionId, expectedVersion: state.version, choice: { kind: "new" } }));
  assert(result.preview);
  return result.preview;
}
async function start(conversationId: string) {
  const current = await review(conversationId);
  return success(await startConversationReprocessing({ conversationId, expectedVersion: current.version, idempotencyKey: randomUUID() }));
}
async function lease(runId: string) {
  const value = { attempt: 1, leaseReference: randomUUID(), expiresAt: new Date(Date.now() + 60000) };
  await prisma.processingRun.update({ where: { id: runId }, data: { status: "RUNNING", stage: "EXTRACTING" } });
  await prisma.processingCheckpoint.create({ data: { workspaceId, runId, stage: "EXTRACTING", attempt: value.attempt, leaseReference: value.leaseReference } });
  return value;
}
function resolution(current: ConversationReview): ResolveReprocessingCandidateInput {
  assert(current.currentRevisionId); assert(current.candidate);
  return { conversationId: current.conversationId, expectedVersion: current.version, baseRevisionId: current.currentRevisionId,
    candidateRevisionId: current.candidate.id, operationId: randomUUID(), keepPrevious: true, clientFields: [], requests: [], removeRequestIds: [] };
}
async function candidate(id: string) {
  await fixture(id);
  const run = await start(id);
  assert(await publishExtraction(run.processingRunId, extraction(), await lease(run.processingRunId)));
  return review(id);
}

export async function verifyReprocessing(db: PgClient) {
  let checks = 0;
  async function check(label: string, work: () => Promise<void>) {
    try { await work(); checks++; console.log(`PASS ${label}`); }
    catch (error) {
      console.error(`FAIL ${label}`);
      if (error instanceof Error && error.message.startsWith("Unexpected service failure:")) console.error(error.message);
      if (error instanceof Error) {
        // Print only the script line; never driver messages, assertion values or inputs.
        const location = error.stack?.match(/reprocessing-integration-worker\.ts:\d+:\d+/)?.[0];
        if (location) console.error(`Check location: ${location}`);
      }
      throw error;
    }
  }
  try {
    assert.match((await db.query("SELECT current_database() AS name")).rows[0].name, /^reprocessing_verify_[a-f0-9]{32}$/);
    for (const id of [actor, "foreign-user"]) {
      await prisma.user.create({ data: { id, email: `${id}@example.com`, name: "Integration", role: "trial_user" } });
      await prisma.workspace.create({ data: { id: `${id}-workspace`, ownerId: id, creditInitializedAt: new Date() } });
      await prisma.session.create({ data: { id: `${id}-session`, userId: id, token: `${id}-token`, expiresAt: new Date(Date.now() + 3600000) } });
    }
    await prisma.creditEntry.create({ data: { workspaceId, kind: "GRANT", quantity: 100, operationKey: "integration-grant" } });

    await check("concurrent starts reserve once, preserve the human revision and invalidate the old plan", async () => {
      const before = await fixture("concurrent-start");
      const plan = await prepare(before.conversationId);
      const current = await review(before.conversationId);
      const input = { conversationId: current.conversationId, expectedVersion: current.version, idempotencyKey: randomUUID() };
      const results = await Promise.all([startConversationReprocessing(input), startConversationReprocessing(input),
        startConversationReprocessing({ ...input, idempotencyKey: randomUUID() })]);
      assert(results.some((result) => result.success), "At least one concurrent start must succeed");
      const runs = await prisma.processingRun.findMany({ where: { conversationId: current.conversationId, status: { in: ["ACCEPTED", "RUNNING"] } } });
      assert.equal(runs.length, 1);
      for (const result of results) if (result.success) assert.equal(result.data.processingRunId, runs[0].id);
      assert.equal(await prisma.creditReservation.count({ where: { processingRunId: runs[0].id } }), 1);
      assert.equal(await prisma.creditEntry.count({ where: { processingRunId: runs[0].id, kind: "RESERVE" } }), 1);
      assert.equal(await prisma.outboxEvent.count({ where: { aggregateId: runs[0].id, eventType: "conversation.extraction.requested" } }), 1);
      assert.equal((await review(current.conversationId)).currentRevisionId, before.currentRevisionId);
      assert.deepEqual((await review(current.conversationId)).revision?.draft, before.revision?.draft);
      assert.equal((await prisma.recordPlan.findUniqueOrThrow({ where: { id: plan.planId } })).status, "INVALIDATED");
      failure(await confirmConversationCreation({ planId: plan.planId, planHash: plan.planHash, acknowledgeDuplicates: true }));
      const currentLease = await lease(runs[0].id);
      const publications = await Promise.all([publishExtraction(runs[0].id, extraction(), currentLease), publishExtraction(runs[0].id, extraction(), currentLease)]);
      assert(publications[0]); assert.equal(publications[0], publications[1]);
      const after = await review(current.conversationId);
      assert.equal(after.currentRevisionId, before.currentRevisionId); assert.equal(after.candidate?.parentRevisionId, before.currentRevisionId);
      assert.deepEqual(after.revision?.draft, before.revision?.draft);
      assert.equal(await prisma.creditEntry.count({ where: { processingRunId: runs[0].id, kind: "CONSUME" } }), 1);
      assert.equal((await prisma.creditReservation.findUniqueOrThrow({ where: { processingRunId: runs[0].id } })).status, "CONSUMED");
      await failConversationProcessingStep(runs[0].id, "LATE_FAILURE", false);
      assert.equal(await prisma.creditEntry.count({ where: { processingRunId: runs[0].id, kind: "RESTORE" } }), 0);
    });

    await check("pending candidate blocks edit, readiness, another extraction and foreign access", async () => {
      const current = await review("concurrent-start"); assert(current.revision);
      const input = resolution(current);
      failure(await saveProposalRevision({ conversationId: current.conversationId, expectedVersion: current.version, baseRevisionId: current.revision.id,
        operationId: randomUUID(), draft: current.revision.draft, resolutions: [] }));
      failure(await markProposalReady({ conversationId: current.conversationId, expectedVersion: current.version, revisionId: current.revision.id }));
      failure(await startConversationReprocessing({ conversationId: current.conversationId, expectedVersion: current.version, idempotencyKey: randomUUID() }));
      process.env.CONVERSATION_VERIFY_ACTOR = "foreign-user";
      try {
        failure(await getConversationReview({ conversationId: current.conversationId }), ["NOT_FOUND"]);
        failure(await resolveReprocessingCandidate(input), ["NOT_FOUND"]);
        failure(await startConversationReprocessing({ conversationId: current.conversationId, expectedVersion: current.version, idempotencyKey: randomUUID() }));
      } finally { delete process.env.CONVERSATION_VERIFY_ACTOR; }
      assert.equal((await review(current.conversationId)).candidate?.id, input.candidateRevisionId);
    });

    await check("explicit keep preserves corrections, records durable decision and replays without another revision", async () => {
      const before = await review("concurrent-start"); const input = resolution(before);
      const auditsBefore = await prisma.auditEvent.count({ where: { workspaceId } });
      const after = success(await resolveReprocessingCandidate(input));
      assert.equal(after.currentRevisionId, before.currentRevisionId); assert.deepEqual(after.revision?.draft, before.revision?.draft);
      assert(!after.candidate); assert.equal(after.status, "needs_review");
      const revisions = await prisma.proposalRevision.count({ where: { conversationId: before.conversationId } });
      const audits = await prisma.auditEvent.count({ where: { workspaceId } }); assert.equal(audits, auditsBefore + 1);
      success(await resolveReprocessingCandidate(input));
      assert.equal(await prisma.proposalRevision.count({ where: { conversationId: before.conversationId } }), revisions);
      assert.equal(await prisma.auditEvent.count({ where: { workspaceId } }), audits);
      failure(await resolveReprocessingCandidate({ ...input, clientFields: ["name"], keepPrevious: false }));
      assert(after.currentRevisionId);
      success(await markProposalReady({ conversationId: after.conversationId, expectedVersion: after.version, revisionId: after.currentRevisionId }));
      assert(await prepare(after.conversationId));
    });

    await check("terminal extraction failure restores once and previous review can be marked ready again", async () => {
      const before = await fixture("failure-recovery"); const run = await start(before.conversationId); const currentLease = await lease(run.processingRunId);
      await failConversationProcessingStep(run.processingRunId, "EXTRACTION_PROVIDER_UNAVAILABLE", true, currentLease);
      await failConversationProcessingStep(run.processingRunId, "EXTRACTION_PROVIDER_UNAVAILABLE", true, currentLease);
      const after = await review(before.conversationId);
      assert.equal(after.status, "needs_review"); assert.equal(after.currentRevisionId, before.currentRevisionId);
      assert.deepEqual(after.revision?.draft, before.revision?.draft); assert(!after.candidate);
      assert.equal(await prisma.creditEntry.count({ where: { processingRunId: run.processingRunId, kind: "RESTORE" } }), 1);
      assert.equal(await prisma.creditEntry.count({ where: { processingRunId: run.processingRunId, kind: "CONSUME" } }), 0);
      assert.equal(await publishExtraction(run.processingRunId, extraction(), currentLease), null);
      assert(after.currentRevisionId);
      success(await markProposalReady({ conversationId: after.conversationId, expectedVersion: after.version, revisionId: after.currentRevisionId }));
    });

    await check("partial adoption retains manual contact and description, maps evidence and adds an explicit request", async () => {
      const before = await candidate("adoption"); assert(before.candidate);
      const input: ResolveReprocessingCandidateInput = { ...resolution(before), keepPrevious: false, requests: [
        { candidateItemId: "candidate-repair", targetItemId: "human-request", fields: ["title"] },
        { candidateItemId: "candidate-inspection", targetItemId: null, fields: [...requestFieldKeys] },
      ] };
      failure(await resolveReprocessingCandidate({ ...input, expectedVersion: input.expectedVersion - 1 }));
      failure(await resolveReprocessingCandidate({ ...input, requests: [{ candidateItemId: "candidate-inspection", targetItemId: null, fields: ["title"] }] }));
      const after = success(await resolveReprocessingCandidate(input)); assert(after.revision);
      assert.notEqual(after.currentRevisionId, before.currentRevisionId); assert(!after.candidate);
      assert.equal(after.revision.authorKind, "human"); assert.equal(after.revision.parentRevisionId, before.currentRevisionId);
      assert.equal(after.revision.draft.client.phone, "+14155550999");
      assert.equal(after.revision.draft.requests.length, 2);
      const retained = after.revision.draft.requests.find((item) => item.stableItemId === "human-request");
      assert.equal(retained?.title, "Repair"); assert.equal(retained?.description, "Human corrected description");
      const title = after.revision.fields.find((field) => field.itemId === "human-request" && field.fieldKey === "title");
      assert.equal(title?.provenance, "extracted"); assert.deepEqual(title?.evidenceIds, ["evidence-1"]);
      assert.equal(after.revision.fields.find((field) => field.fieldKey === "phone")?.provenance, "manual");
      assert.equal(success(await resolveReprocessingCandidate(input)).currentRevisionId, after.currentRevisionId);
      const history = success(await getConversationReview({ conversationId: before.conversationId, revisionId: before.currentRevisionId! }));
      assert.deepEqual(history.revision?.draft, before.revision?.draft);
      const archived = success(await getConversationReview({ conversationId: before.conversationId, revisionId: before.candidate.id }));
      assert.deepEqual(archived.revision?.draft, before.candidate.draft);
      failure(await resolveReprocessingCandidate({ ...input, operationId: randomUUID() }));
    });

    await check("publication rollback leaves no partial candidate or debit and can subsequently publish", async () => {
      await fixture("publication-rollback"); const run = await start("publication-rollback"); const currentLease = await lease(run.processingRunId);
      await db.query(`CREATE FUNCTION integration_fail_consume() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.kind::text = 'CONSUME' THEN RAISE EXCEPTION 'synthetic publication rollback'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER integration_fail_consume BEFORE INSERT ON credit_entries FOR EACH ROW EXECUTE FUNCTION integration_fail_consume()`);
      try { await assert.rejects(publishExtraction(run.processingRunId, extraction(), currentLease)); }
      finally { await db.query("DROP TRIGGER integration_fail_consume ON credit_entries; DROP FUNCTION integration_fail_consume()"); }
      assert.equal(await prisma.proposalRevision.count({ where: { producingRunId: run.processingRunId } }), 0);
      assert.equal((await prisma.creditReservation.findUniqueOrThrow({ where: { processingRunId: run.processingRunId } })).status, "ACTIVE");
      assert(await publishExtraction(run.processingRunId, extraction(), currentLease));
    });

    await check("creation confirmation racing reprocessing admits only one transition", async () => {
      await fixture("confirmation-race"); const plan = await prepare("confirmation-race");
      const current = await review("confirmation-race");
      const [creation, reprocessing] = await Promise.all([
        confirmConversationCreation({ planId: plan.planId, planHash: plan.planHash, acknowledgeDuplicates: true }),
        startConversationReprocessing({ conversationId: current.conversationId, expectedVersion: current.version, idempotencyKey: randomUUID() }),
      ]);
      assert(creation.success || reprocessing.success); assert(!(creation.success && reprocessing.success));
      const count = await prisma.operationReceipt.count({ where: { sourceConversationId: current.conversationId } });
      assert.equal(count, creation.success ? 1 : 0);
      if (reprocessing.success) {
        assert.equal((await review(current.conversationId)).status, "extracting");
        await failConversationProcessingStep(reprocessing.data.processingRunId, "SYNTHETIC_TEST_FINISH", false);
      } else assert.equal((await review(current.conversationId)).status, "completed");
    });

    await check("completed conversations reject reprocesing without creating a reservation", async () => {
      await fixture("completed"); const plan = await prepare("completed");
      success(await confirmConversationCreation({ planId: plan.planId, planHash: plan.planHash, acknowledgeDuplicates: true }));
      const before = await prisma.creditReservation.count(); const current = await review("completed");
      failure(await startConversationReprocessing({ conversationId: current.conversationId, expectedVersion: current.version, idempotencyKey: randomUUID() }));
      assert.equal(await prisma.creditReservation.count(), before);
    });

    await check("cleanup removes prior revisions, pending candidates, fields and evidence links", async () => {
      const current = await candidate("cleanup"); assert(current.candidate);
      await prisma.$transaction(async (tx) => {
        await tx.conversation.update({ where: { id: current.conversationId }, data: { deletionState: "DELETE_REQUESTED" } });
        await deleteConversationProposals(tx, workspaceId, current.conversationId);
      });
      assert.equal(await prisma.proposalRevision.count({ where: { conversationId: current.conversationId } }), 0);
      assert.equal(await prisma.proposalField.count({ where: { revisionId: { in: [current.currentRevisionId!, current.candidate.id] } } }), 0);
      assert.equal(await prisma.proposalFieldEvidence.count({ where: { evidence: { transcriptId: "transcript-cleanup" } } }), 0);
      assert.equal((await prisma.conversation.findUniqueOrThrow({ where: { id: current.conversationId } })).currentProposalRevisionId, null);
      failure(await getConversationReview({ conversationId: current.conversationId }), ["NOT_FOUND"]);
    });
    console.log(`PASS ${checks} safe reprocessing production-service PostgreSQL checks`);
  } finally { await prisma.$disconnect(); }
}
