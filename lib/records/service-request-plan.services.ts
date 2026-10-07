import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { resolveCurrentWorkspace } from "@/lib/auth/session";
import type { ServiceResponse } from "@/lib/api-responses";
import { createServiceRequestSchema } from "@/modules/requests/form/create/schemas/create-service-request-schema";
import {
  confirmServiceRequestCreationSchema, normalizeRequestDraft,
  type ConfirmServiceRequestCreationInput, type CreateServiceRequestDto,
  type ServiceRequestCreationPreview, type ServiceRequestCreationResult,
} from "@/modules/requests/lib/types/service-request.types";
import { assertRecordAccess, isRetryableRecordConflict, recordError, recordFailure } from "./record-policy";
import { writeRequestRecord } from "./record-writes";
import { hasExcludedSensitiveValues } from "./sensitive-submission-policy";

const PLAN_TTL_MS = 15 * 60 * 1000;
const requestDraftSchema = z.object({
  title: z.string(), description: z.string(),
  serviceType: z.enum(["installation", "repair", "maintenance", "inspection", "other"]),
  priority: z.enum(["low", "normal", "high"]),
  preferredSchedule: z.string().nullable(), serviceAddress: z.string().nullable(), nextSteps: z.string().nullable(),
}).strict();

function hashPlan(input: { operationIntent: string; workspaceId: string; actorId: string;
  clientId: string; clientVersion: number; request: z.infer<typeof requestDraftSchema>; expiresAt: string }) {
  return createHash("sha256").update(JSON.stringify({ kind: "MANUAL_REQUEST_CREATE", version: 1, ...input })).digest("hex");
}

async function audit(tx: Prisma.TransactionClient, input: { workspaceId: string; actorId: string;
  resourceId: string; operationIntent: string; action: string; outcome: "SUCCEEDED" | "DENIED"; reason?: string }) {
  await tx.auditEvent.create({ data: { workspaceId: input.workspaceId, actorUserId: input.actorId,
    resourceType: "record_plan", resourceId: input.resourceId, action: input.action, outcome: input.outcome,
    correlationId: input.operationIntent, safeMetadata: { kind: "MANUAL_REQUEST_CREATE", ...(input.reason ? { reason: input.reason } : {}) } } });
}

export async function prepareServiceRequestCreation(dto: CreateServiceRequestDto): Promise<ServiceResponse<ServiceRequestCreationPreview>> {
  const parsed = createServiceRequestSchema.safeParse(dto);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  const request = normalizeRequestDraft(parsed.data);
  if (hasExcludedSensitiveValues({ ...request })) return recordFailure("SENSITIVE_DATA");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    const operationIntent = randomUUID();
    const expiresAt = new Date(Date.now() + PLAN_TTL_MS);
    return await prisma.$transaction(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);
      const client = await tx.client.findFirst({ where: { id: parsed.data.clientId, workspaceId: workspace.id },
        select: { id: true, name: true, version: true } });
      if (!client) return recordFailure("NOT_FOUND");
      const planHash = hashPlan({ operationIntent, workspaceId: workspace.id, actorId: session.user.id,
        clientId: client.id, clientVersion: client.version, request, expiresAt: expiresAt.toISOString() });
      const plan = await tx.recordPlan.create({ data: {
        workspaceId: workspace.id, kind: "MANUAL_REQUEST_CREATE", normalizedPayload: { ...request },
        selectedClientId: client.id, selectedClientVersion: client.version, planHash, operationIntent,
        expiresAt, createdByUserId: session.user.id,
      }, select: { id: true } });
      await audit(tx, { workspaceId: workspace.id, actorId: session.user.id, resourceId: plan.id,
        operationIntent, action: "record_plan.prepare", outcome: "SUCCEEDED" });
      return { success: true as const, data: { planId: plan.id, planHash, expiresAt: expiresAt.toISOString(),
        client: { id: client.id, name: client.name }, request } };
    }, { isolationLevel: "Serializable" });
  } catch (error) { return recordError(error); }
}

export async function confirmServiceRequestCreation(input: ConfirmServiceRequestCreationInput): Promise<ServiceResponse<ServiceRequestCreationResult>> {
  const parsed = confirmServiceRequestCreationSchema.safeParse(input);
  if (!parsed.success) return recordFailure("VALIDATION_ERROR");
  try {
    const { session, workspace } = await resolveCurrentWorkspace();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          await assertRecordAccess(tx, session, workspace.id);
          const plan = await tx.recordPlan.findFirst({ where: { id: parsed.data.planId, workspaceId: workspace.id,
            createdByUserId: session.user.id, kind: "MANUAL_REQUEST_CREATE" },
            include: { receipt: true, approvals: true, selectedClient: { select: { id: true, name: true, version: true } } } });
          if (!plan) return recordFailure("NOT_FOUND");
          const deny = async (code: string, invalidate = false) => {
            if (invalidate) await tx.recordPlan.update({ where: { id: plan.id, workspaceId: workspace.id },
              data: { status: code === "PLAN_EXPIRED" ? "EXPIRED" : "INVALIDATED", invalidatedAt: new Date() } });
            await audit(tx, { workspaceId: workspace.id, actorId: session.user.id, resourceId: plan.id,
              operationIntent: plan.operationIntent, action: "record_plan.confirm", outcome: "DENIED", reason: code });
            return recordFailure(code);
          };
          if (plan.planHash !== parsed.data.planHash) return deny("PLAN_STALE");
          if (plan.receipt) {
            const ids = z.array(z.string()).safeParse(plan.receipt.resultRequestIds);
            if (plan.receipt.outcome !== "SUCCEEDED" || !ids.success || ids.data.length !== 1 ||
                plan.receipt.actorUserId !== session.user.id || plan.receipt.workspaceId !== workspace.id) {
              return recordFailure("CONFIRMATION_UNCERTAIN");
            }
            return { success: true as const, data: { requestId: ids.data[0], operationId: plan.receipt.id, replayed: true } };
          }
          if (plan.status !== "PREPARED" || plan.planVersion !== 1 || plan.approvals.length > 0) return deny("PLAN_STALE");
          if (plan.expiresAt.getTime() <= Date.now()) return deny("PLAN_EXPIRED", true);
          const draft = requestDraftSchema.safeParse(plan.normalizedPayload);
          if (!draft.success || !plan.selectedClient || plan.selectedClientVersion === null) return deny("PLAN_STALE", true);
          const request = draft.data;
          const validRequest = createServiceRequestSchema.safeParse({ clientId: plan.selectedClient.id,
            ...Object.fromEntries(Object.entries(request).map(([key, value]) => [key, value ?? undefined])) });
          if (!validRequest.success || hasExcludedSensitiveValues({ ...request })) return deny("PLAN_STALE", true);
          if (plan.selectedClient.version !== plan.selectedClientVersion) return deny("CLIENT_CHANGED", true);
          const expectedHash = hashPlan({ operationIntent: plan.operationIntent, workspaceId: workspace.id,
            actorId: session.user.id, clientId: plan.selectedClient.id, clientVersion: plan.selectedClientVersion,
            request, expiresAt: plan.expiresAt.toISOString() });
          if (expectedHash !== plan.planHash) return deny("PLAN_STALE", true);
          await tx.recordApproval.create({ data: { workspaceId: workspace.id, planId: plan.id, planHash: plan.planHash,
            userId: session.user.id, decision: "APPROVED", expiresAt: plan.expiresAt } });
          const receipt = await tx.operationReceipt.create({ data: { workspaceId: workspace.id, planId: plan.id,
            operationIntent: plan.operationIntent, idempotencyKey: plan.operationIntent, origin: "MANUAL",
            selectedClientId: plan.selectedClient.id, actorUserId: session.user.id }, select: { id: true } });
          const created = await writeRequestRecord(tx, { workspaceId: workspace.id, actorId: session.user.id, operationId: receipt.id, clientId: plan.selectedClient.id }, request);
          await tx.operationReceipt.update({ where: { id: receipt.id, workspaceId: workspace.id }, data: {
            outcome: "SUCCEEDED", completedAt: new Date(), resultRequestIds: [created.id],
          } });
          await tx.recordPlan.update({ where: { id: plan.id, workspaceId: workspace.id }, data: { status: "COMMITTED" } });
          await audit(tx, { workspaceId: workspace.id, actorId: session.user.id, resourceId: plan.id,
            operationIntent: plan.operationIntent, action: "service_request.create", outcome: "SUCCEEDED" });
          return { success: true as const, data: { requestId: created.id, operationId: receipt.id, replayed: false } };
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (isRetryableRecordConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    return recordFailure("CONFIRMATION_UNCERTAIN");
  } catch (error) { return recordError(error, true); }
}
