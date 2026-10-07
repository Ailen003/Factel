// Opt-in: CLIENTS_POSTGRES_TEST=1 pnpm test:unit:run test/integration/clients-postgres.test.ts
// Uses the existing local schema. Every fixture and service write is rolled back.
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/lib/persistence/generated/client";
import type { AuthenticatedSession } from "@/lib/auth/types";
import type { ServiceResponse } from "@/lib/api-responses";

const state = vi.hoisted(() => ({
  tx: null as Prisma.TransactionClient | null,
  session: null as AuthenticatedSession | null,
  workspaceId: "",
  failAudit: false,
}));

vi.mock("@/lib/auth/session", () => ({
  resolveCurrentWorkspace: async () => ({
    session: state.session,
    workspace: { id: state.workspaceId, ownerId: state.session?.user.id, lifecycle: "ACTIVE" },
  }),
}));

vi.mock("@/lib/persistence/prisma", () => {
  const transactionProxy = new Proxy({} as Prisma.TransactionClient, {
    get(_target, property) {
      if (!state.tx) throw new Error("Integration transaction not open");
      if (property === "auditEvent" && state.failAudit) {
        return { create: async () => { throw new Error("Injected audit persistence failure"); } };
      }
      return Reflect.get(state.tx, property);
    },
  });
  return {
    prisma: new Proxy({}, {
      get(_target, property) {
        if (property !== "$transaction") return Reflect.get(transactionProxy, property);
        return async (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
          // Savepoints reproduce service rollback while the enclosing test transaction
          // guarantees no test content is committed to the developer's database.
          const tx = state.tx!;
          await tx.$executeRawUnsafe("SAVEPOINT clients_service_check");
          try {
            const result = await operation(transactionProxy);
            await tx.$executeRawUnsafe("RELEASE SAVEPOINT clients_service_check");
            return result;
          } catch (error) {
            await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT clients_service_check");
            await tx.$executeRawUnsafe("RELEASE SAVEPOINT clients_service_check");
            throw error;
          }
        };
      },
    }),
  };
});

function data<T>(response: ServiceResponse<T>): T {
  expect(response.success).toBe(true);
  if (!response.success) throw new Error(response.error.code);
  return response.data;
}

describe.runIf(process.env.CLIENTS_POSTGRES_TEST === "1")("client and request PostgreSQL contract", () => {
  it("persists governed records, scopes reads, enforces client lifecycle rules and rolls back failed audit", async () => {
    await import("dotenv/config");
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || process.env.NODE_ENV === "production") {
      throw new Error("This integration check requires a local non-production database");
    }
    const { PrismaClient } = await import("@/lib/persistence/generated/client");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }), log: [] });
    const { prepareClientCreation, confirmClientCreation } = await import("@/lib/records/record-plan.services");
    const { deleteClient, editClient, getAllClients, getClientById } = await import("@/modules/clients/lib/services/client.services");
    const { parseClientFilters } = await import("@/modules/clients/lib/types/client.types");
    const { prepareServiceRequestCreation, confirmServiceRequestCreation } = await import("@/lib/records/service-request-plan.services");
    const {
      changeServiceRequestStatus,
      deleteServiceRequest,
      editServiceRequest,
      getAllServiceRequests,
      getServiceRequestById,
    } = await import("@/modules/requests/lib/services/service-request.services");
    const { parseServiceRequestFilters } = await import("@/modules/requests/lib/types/service-request.types");
    const fixtureId = randomUUID();
    const rollback = new Error("Rollback integration fixtures");
    const userIds: string[] = [];
    try {
      await expect(db.$transaction(async (tx) => {
        state.tx = tx;
        const actors: { session: AuthenticatedSession; workspaceId: string }[] = [];
        for (const label of ["a", "b"]) {
          const user = await tx.user.create({ data: { email: `client-check-${fixtureId}-${label}@example.com`, name: "Client check", role: "trial_user" } });
          userIds.push(user.id);
          const workspace = await tx.workspace.create({ data: { ownerId: user.id } });
          const session = await tx.session.create({ data: { userId: user.id, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } });
          actors.push({ session: { user, session } as unknown as AuthenticatedSession, workspaceId: workspace.id });
        }
        const useActor = (index: number) => {
          state.session = actors[index].session;
          state.workspaceId = actors[index].workspaceId;
        };
        useActor(0);
        const preview = data(await prepareClientCreation({
          name: "  Ana Demo  ", email: " ANA@example.com ", phone: "+1 (415) 555-0100", company: " ACME ", notes: "  ",
        }));
        expect(preview.client).toMatchObject({ name: "Ana Demo", email: "ana@example.com", phone: "+14155550100", company: "ACME", notes: null });
        expect(preview.duplicates).toHaveLength(0);
        expect(await tx.client.count({ where: { workspaceId: state.workspaceId } })).toBe(0);
        const approval = { planId: preview.planId, planHash: preview.planHash, acknowledgeDuplicates: false };

        useActor(1);
        expect(await confirmClientCreation(approval)).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
        useActor(0);
        const created = data(await confirmClientCreation(approval));
        expect(created.replayed).toBe(false);
        expect(data(await confirmClientCreation(approval))).toEqual({ ...created, replayed: true });
        const saved = data(await getClientById(created.clientId));
        expect(saved).toMatchObject(preview.client);
        expect(await tx.operationReceipt.count({ where: { workspaceId: state.workspaceId } })).toBe(1);
        expect(await tx.recordApproval.count({ where: { planId: preview.planId } })).toBe(1);
        expect(data(await getAllClients(parseClientFilters({ search: "ACME", page: "999" }))).pagination).toMatchObject({ total: 1, page: 1 });

        useActor(1);
        expect(data(await getAllClients(parseClientFilters({}))).clients).toEqual([]);
        expect(await getClientById(created.clientId)).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
        const otherWorkspacePreview = data(await prepareClientCreation({ name: "Other workspace", email: "ana@example.com" }));
        expect(otherWorkspacePreview.duplicates).toEqual([]);
        const otherWorkspaceClient = data(await confirmClientCreation({
          planId: otherWorkspacePreview.planId,
          planHash: otherWorkspacePreview.planHash,
          acknowledgeDuplicates: false,
        }));

        useActor(0);
        const duplicate = data(await prepareClientCreation({ name: "Distinct person", email: "ana@example.com" }));
        expect(duplicate.duplicates.map((item) => item.id)).toEqual([created.clientId]);
        const duplicateApproval = { planId: duplicate.planId, planHash: duplicate.planHash, acknowledgeDuplicates: false };
        expect(await confirmClientCreation(duplicateApproval)).toMatchObject({ success: false, error: { code: "DUPLICATE_ACKNOWLEDGMENT_REQUIRED" } });
        const duplicateClient = data(await confirmClientCreation({ ...duplicateApproval, acknowledgeDuplicates: true }));
        expect(duplicateClient.clientId).not.toBe(created.clientId);
        expect(data(await getClientById(created.clientId)).name).toBe("Ana Demo");

        const stale = data(await prepareClientCreation({ name: "New match", email: "ana@example.com" }));
        await tx.client.update({ where: { id: created.clientId }, data: { version: { increment: 1 } } });
        expect(await confirmClientCreation({ planId: stale.planId, planHash: stale.planHash, acknowledgeDuplicates: true })).toMatchObject({ success: false, error: { code: "DUPLICATES_CHANGED" } });

        const failed = data(await prepareClientCreation({ name: "Atomic audit", email: "audit@example.com" }));
        state.failAudit = true;
        const failure = await confirmClientCreation({ planId: failed.planId, planHash: failed.planHash, acknowledgeDuplicates: false });
        state.failAudit = false;
        expect(failure).toMatchObject({ success: false, error: { code: "CONFIRMATION_UNCERTAIN" } });
        expect(await tx.client.count({ where: { workspaceId: state.workspaceId, normalizedEmail: "audit@example.com" } })).toBe(0);
        expect(await tx.operationReceipt.count({ where: { planId: failed.planId } })).toBe(0);
        expect(await tx.recordApproval.count({ where: { planId: failed.planId } })).toBe(0);
        expect((await tx.recordPlan.findUniqueOrThrow({ where: { id: failed.planId } })).status).toBe("PREPARED");
        expect(data(await confirmClientCreation({ planId: failed.planId, planHash: failed.planHash, acknowledgeDuplicates: false })).replayed).toBe(false);

        // Replayed committed operations remain reconcilable even after the preview expires.
        await tx.recordPlan.update({ where: { id: preview.planId }, data: { expiresAt: new Date(0) } });
        expect(data(await confirmClientCreation(approval)).operationId).toBe(created.operationId);

        const beforeEdit = data(await getClientById(created.clientId));
        const edited = data(await editClient({ id: created.clientId, expectedVersion: beforeEdit.version,
          acknowledgeDuplicates: false, client: { name: "Ana Managed", email: "managed@example.com" } }));
        expect(edited).toMatchObject({ name: "Ana Managed", email: "managed@example.com", version: beforeEdit.version + 1 });
        expect(await editClient({ id: created.clientId, expectedVersion: beforeEdit.version,
          acknowledgeDuplicates: false, client: { name: "Stale edit", email: "stale@example.com" } }))
          .toMatchObject({ success: false, error: { code: "STALE_VERSION" } });

        const requestPreview = data(await prepareServiceRequestCreation({ clientId: created.clientId,
          title: " Install router ", description: " Configure the office router ", serviceType: "installation", priority: "high" }));
        expect(requestPreview).toMatchObject({ client: { id: created.clientId, name: "Ana Managed" },
          request: { title: "Install router", description: "Configure the office router" } });
        useActor(1);
        expect(await confirmServiceRequestCreation({ planId: requestPreview.planId, planHash: requestPreview.planHash }))
          .toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
        useActor(0);
        const request = data(await confirmServiceRequestCreation({ planId: requestPreview.planId, planHash: requestPreview.planHash }));
        expect(request.replayed).toBe(false);
        expect(data(await confirmServiceRequestCreation({ planId: requestPreview.planId, planHash: requestPreview.planHash })))
          .toEqual({ ...request, replayed: true });
        expect(data(await getServiceRequestById(request.requestId))).toMatchObject({ title: "Install router", status: "pending",
          priority: "high", client: { id: created.clientId, name: "Ana Managed" } });
        expect(data(await getAllServiceRequests(parseServiceRequestFilters({ search: "router", priority: "high" }))).requests)
          .toHaveLength(1);
        useActor(1);
        expect(data(await getAllServiceRequests(parseServiceRequestFilters({}))).requests).toEqual([]);
        expect(await getServiceRequestById(request.requestId)).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
        useActor(0);
        expect(await deleteClient({ id: created.clientId, expectedVersion: edited.version }))
          .toMatchObject({ success: false, error: { code: "CLIENT_HAS_REQUESTS" } });

        const beforeRequestEdit = data(await getServiceRequestById(request.requestId));
        useActor(1);
        expect(await editServiceRequest({ id: request.requestId, expectedVersion: beforeRequestEdit.version,
          request: { clientId: otherWorkspaceClient.clientId, title: "Cross workspace", description: "Rejected",
            serviceType: "repair", priority: "normal" } }))
          .toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
        useActor(0);
        expect(await editServiceRequest({ id: request.requestId, expectedVersion: beforeRequestEdit.version,
          request: { clientId: otherWorkspaceClient.clientId, title: "Cross workspace", description: "Rejected",
            serviceType: "repair", priority: "normal" } }))
          .toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
        const editedRequest = data(await editServiceRequest({ id: request.requestId, expectedVersion: beforeRequestEdit.version,
          request: { clientId: duplicateClient.clientId, title: "Repair managed router",
            description: "Diagnose and configure the office router", serviceType: "repair", priority: "low",
            preferredSchedule: "Tomorrow morning", nextSteps: "Confirm connectivity" } }));
        expect(editedRequest).toMatchObject({ title: "Repair managed router", serviceType: "repair", priority: "low",
          status: "pending", version: beforeRequestEdit.version + 1,
          client: { id: duplicateClient.clientId } });
        expect(await editServiceRequest({ id: request.requestId, expectedVersion: beforeRequestEdit.version,
          request: { clientId: created.clientId, title: "Stale request", description: "Must not overwrite",
            serviceType: "installation", priority: "high" } }))
          .toMatchObject({ success: false, error: { code: "STALE_VERSION" } });

        const inProgress = data(await changeServiceRequestStatus({ id: request.requestId,
          expectedVersion: editedRequest.version, status: "in_progress" }));
        expect(inProgress).toMatchObject({ status: "in_progress", version: editedRequest.version + 1 });
        expect(await changeServiceRequestStatus({ id: request.requestId,
          expectedVersion: editedRequest.version, status: "resolved" }))
          .toMatchObject({ success: false, error: { code: "STALE_VERSION" } });
        expect(await changeServiceRequestStatus({ id: request.requestId,
          expectedVersion: inProgress.version, status: "in_progress" }))
          .toMatchObject({ success: false, error: { code: "INVALID_STATUS_TRANSITION" } });
        const resolvedRequest = data(await changeServiceRequestStatus({ id: request.requestId,
          expectedVersion: inProgress.version, status: "resolved" }));
        const reopenedRequest = data(await changeServiceRequestStatus({ id: request.requestId,
          expectedVersion: resolvedRequest.version, status: "pending" }));
        expect(reopenedRequest).toMatchObject({ status: "pending", version: resolvedRequest.version + 1 });

        expect(data(await deleteClient({ id: created.clientId, expectedVersion: edited.version })))
          .toEqual({ clientId: created.clientId });
        expect(await getClientById(created.clientId)).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
        expect(await tx.recordPlan.findUniqueOrThrow({ where: { id: requestPreview.planId } }))
          .toMatchObject({ normalizedPayload: expect.anything(), payloadPurgedAt: null });
        expect(data(await deleteServiceRequest({ id: request.requestId, expectedVersion: reopenedRequest.version })))
          .toEqual({ requestId: request.requestId });
        expect(await getServiceRequestById(request.requestId)).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
        expect(await tx.client.count({ where: { id: duplicateClient.clientId, workspaceId: state.workspaceId } })).toBe(1);
        expect(await tx.operationReceipt.count({ where: { id: request.operationId, workspaceId: state.workspaceId } })).toBe(1);
        expect(await tx.recordPlan.findUniqueOrThrow({ where: { id: requestPreview.planId } }))
          .toMatchObject({ normalizedPayload: null, payloadPurgedAt: expect.any(Date) });

        const disposablePreview = data(await prepareClientCreation({ name: "Disposable", email: "disposable@example.com" }));
        const disposable = data(await confirmClientCreation({ planId: disposablePreview.planId,
          planHash: disposablePreview.planHash, acknowledgeDuplicates: false }));
        const disposableClient = data(await getClientById(disposable.clientId));
        expect(data(await deleteClient({ id: disposable.clientId, expectedVersion: disposableClient.version })))
          .toEqual({ clientId: disposable.clientId });
        expect(await getClientById(disposable.clientId)).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
        throw rollback;
      }, { isolationLevel: "Serializable", timeout: 30_000 })).rejects.toBe(rollback);
      expect(await db.user.count({ where: { id: { in: userIds } } })).toBe(0);
    } finally {
      state.tx = null;
      state.failAudit = false;
      await db.$disconnect();
    }
  }, 45_000);
});
