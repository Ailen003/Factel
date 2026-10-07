import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { resolveCurrentWorkspace } from "@/lib/auth/session";
import type { ServiceResponse } from "@/lib/api-responses";
import { createClientSchema } from "@/modules/clients/form/create/schemas/create-client-schema";
import {
  confirmClientCreationSchema, type ClientCreationDraft, type ClientCreationPreview,
  type ClientCreationResult, type ClientDuplicateCandidate, type ConfirmClientCreationInput,
  type CreateClientDto,
} from "@/modules/clients/lib/types/client.types";
import { assertRecordAccess, isRetryableRecordConflict, recordError, recordFailure } from "./record-policy";
import { normalizeClientDraft as normalizedDraft, findClientDuplicates as findDuplicates, writeClientRecord } from "./record-writes";
import { hasExcludedSensitiveValues } from "./sensitive-submission-policy";

const PLAN_TTL_MS = 15 * 60 * 1000;

const draftSchema = z.object({ name: z.string(), email: z.string().nullable(), phone: z.string().nullable(),
  company: z.string().nullable(), address: z.string().nullable(), notes: z.string().nullable() }).strict();
const snapshotSchema = z.array(z.object({ id: z.string(), version: z.number().int().positive() }).strict());
type Snapshot = z.infer<typeof snapshotSchema>;

function snapshot(candidates: ClientDuplicateCandidate[]): Snapshot {
  return candidates.map(({ id, version }) => ({ id, version }));
}
function hashPlan(input: { operationIntent: string; workspaceId: string; actorId: string;
  client: ClientCreationDraft; duplicates: Snapshot; expiresAt: string; duplicateDecision: string }) {
  return createHash("sha256").update(JSON.stringify({ kind: "MANUAL_CLIENT_CREATE", version: 1, ...input })).digest("hex");
}

async function audit(tx: Prisma.TransactionClient, input: { workspaceId: string; actorId: string;
  resourceId: string; operationIntent: string; action: string; outcome: "SUCCEEDED" | "DENIED";
  reason?: string; duplicateCount?: number }) {
  await tx.auditEvent.create({ data: { workspaceId: input.workspaceId, actorUserId: input.actorId,
    resourceType: "record_plan", resourceId: input.resourceId, action: input.action, outcome: input.outcome,
    correlationId: input.operationIntent,
    safeMetadata: { kind: "MANUAL_CLIENT_CREATE", ...(input.reason ? { reason: input.reason } : {}),
      ...(input.duplicateCount !== undefined ? { duplicateCount: input.duplicateCount } : {}) } } });
}

export async function prepareClientCreation(dto: CreateClientDto): Promise<ServiceResponse<ClientCreationPreview>> {
  const parsed = createClientSchema.safeParse(dto);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  const client = normalizedDraft(parsed.data);
  if (hasExcludedSensitiveValues({ ...client })) return recordFailure("SENSITIVE_DATA");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    const operationIntent = randomUUID();
    const expiresAt = new Date(Date.now() + PLAN_TTL_MS);
    return await prisma.$transaction(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      const duplicates = await findDuplicates(tx, workspace.id, client);
      // This is the proposed decision, still requiring explicit approval below.
      const duplicateDecision = duplicates.length ? "CREATE_DISTINCT" : "NO_MATCHES";
      const planHash = hashPlan({ operationIntent, workspaceId: workspace.id, actorId: session.user.id,
        client, duplicates: snapshot(duplicates), expiresAt: expiresAt.toISOString(), duplicateDecision });
      const plan = await tx.recordPlan.create({ data: { workspaceId: workspace.id, kind: "MANUAL_CLIENT_CREATE",
        normalizedPayload: { ...client }, duplicateCandidates: snapshot(duplicates), duplicateDecision,
        planHash, operationIntent, expiresAt, createdByUserId: session.user.id }, select: { id: true } });
      await audit(tx, { workspaceId: workspace.id, actorId: session.user.id, resourceId: plan.id,
        operationIntent, action: "record_plan.prepare", outcome: "SUCCEEDED", duplicateCount: duplicates.length });
      return { success: true as const, data: { planId: plan.id, planHash, expiresAt: expiresAt.toISOString(), client, duplicates } };
    }, { isolationLevel: "Serializable" });
  } catch (error) { return recordError(error); }
}

export async function confirmClientCreation(input: ConfirmClientCreationInput): Promise<ServiceResponse<ClientCreationResult>> {
  const parsed = confirmClientCreationSchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          await assertRecordAccess(tx, session, workspace.id);
          const plan = await tx.recordPlan.findFirst({ where: { id: parsed.data.planId,
            workspaceId: workspace.id, createdByUserId: session.user.id, kind: "MANUAL_CLIENT_CREATE" },
            include: { receipt: true, approvals: true } });
          if (!plan) return recordFailure("NOT_FOUND");
          const deny = async (code: string, invalidate = false) => {
            if (invalidate) await tx.recordPlan.update({ where: { id: plan.id, workspaceId: workspace.id },
              data: { status: code === "PLAN_EXPIRED" ? "EXPIRED" : "INVALIDATED", invalidatedAt: new Date() } });
            await audit(tx, { workspaceId: workspace.id, actorId: session.user.id, resourceId: plan.id,
              operationIntent: plan.operationIntent, action: "record_plan.confirm", outcome: "DENIED", reason: code });
            return recordFailure(code);
          };
          if (plan.planHash !== parsed.data.planHash) return deny("PLAN_STALE");
          // Reconciliation precedes freshness checks: a committed plan stays replayable after expiry.
          if (plan.receipt) {
            if (plan.receipt.outcome !== "SUCCEEDED" || !plan.receipt.selectedClientId ||
                plan.receipt.actorUserId !== session.user.id || plan.receipt.workspaceId !== workspace.id) {
              return recordFailure("CONFIRMATION_UNCERTAIN");
            }
            return { success: true as const, data: { clientId: plan.receipt.selectedClientId,
              operationId: plan.receipt.id, replayed: true } };
          }
          if (plan.status !== "PREPARED" || plan.planVersion !== 1 || plan.approvals.length > 0) return deny("PLAN_STALE");
          if (plan.expiresAt.getTime() <= Date.now()) return deny("PLAN_EXPIRED", true);
          const draft = draftSchema.safeParse(plan.normalizedPayload);
          const storedSnapshot = snapshotSchema.safeParse(plan.duplicateCandidates);
          if (!draft.success || !storedSnapshot.success || !plan.duplicateDecision) return deny("PLAN_STALE", true);
          const client = draft.data;
          const validClient = createClientSchema.safeParse(Object.fromEntries(Object.entries(client).map(([key, value]) => [key, value ?? undefined])));
          if (!validClient.success || hasExcludedSensitiveValues({ ...client })) return deny("PLAN_STALE", true);
          const expectedHash = hashPlan({ operationIntent: plan.operationIntent, workspaceId: workspace.id,
            actorId: session.user.id, client, duplicates: storedSnapshot.data,
            expiresAt: plan.expiresAt.toISOString(), duplicateDecision: plan.duplicateDecision });
          if (expectedHash !== plan.planHash) return deny("PLAN_STALE", true);
          const duplicates = await findDuplicates(tx, workspace.id, client);
          if (JSON.stringify(snapshot(duplicates)) !== JSON.stringify(storedSnapshot.data)) return deny("DUPLICATES_CHANGED", true);
          if (duplicates.length && !parsed.data.acknowledgeDuplicates) return deny("DUPLICATE_ACKNOWLEDGMENT_REQUIRED");
          await tx.recordApproval.create({ data: { workspaceId: workspace.id, planId: plan.id, planHash: plan.planHash,
            userId: session.user.id, decision: "APPROVED", expiresAt: plan.expiresAt } });
          // The schema requires receipt first, client second, then completion of the receipt.
          const receipt = await tx.operationReceipt.create({ data: { workspaceId: workspace.id, planId: plan.id,
            operationIntent: plan.operationIntent, idempotencyKey: plan.operationIntent,
            origin: "MANUAL", actorUserId: session.user.id }, select: { id: true } });
          const created = await writeClientRecord(tx, { workspaceId: workspace.id, actorId: session.user.id, operationId: receipt.id }, client);
          await tx.operationReceipt.update({ where: { id: receipt.id, workspaceId: workspace.id },
            data: { selectedClientId: created.id, outcome: "SUCCEEDED", completedAt: new Date(), resultRequestIds: [] } });
          await tx.recordPlan.update({ where: { id: plan.id, workspaceId: workspace.id }, data: { status: "COMMITTED" } });
          // Persisted inside the same transaction: no post-commit logging can obscure the result.
          await audit(tx, { workspaceId: workspace.id, actorId: session.user.id, resourceId: plan.id,
            operationIntent: plan.operationIntent, action: "client.create", outcome: "SUCCEEDED", duplicateCount: duplicates.length });
          return { success: true as const, data: { clientId: created.id, operationId: receipt.id, replayed: false } };
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (isRetryableRecordConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    return recordFailure("CONFIRMATION_UNCERTAIN");
  } catch (error) { return recordError(error, true); }
}
