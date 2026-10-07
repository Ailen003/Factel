import "server-only";

import type { Prisma } from "@/lib/persistence/generated/client";
import type { ServiceResponse } from "@/lib/api-responses";
import { AuthError, type AuthenticatedSession } from "@/lib/auth/types";

export function recordFailure(code: string, details?: Record<string, unknown>): ServiceResponse<never> {
  return { success: false, error: { code, message: code, ...(details ? { details } : {}) } };
}

export function recordError(error: unknown, uncertain = false): ServiceResponse<never> {
  if (error instanceof AuthError) return recordFailure(error.code);
  // Never log input, query parameters, driver messages or contact details.
  console.error("Record operation failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
  return recordFailure(uncertain ? "CONFIRMATION_UNCERTAIN" : "INTERNAL_ERROR");
}

export async function assertRecordAccess(
  tx: Prisma.TransactionClient, session: AuthenticatedSession, workspaceId: string,
): Promise<void> {
  const workspace = await tx.workspace.findFirst({
    where: { id: workspaceId, ownerId: session.user.id, lifecycle: "ACTIVE",
      owner: { status: "active", banned: false, role: session.user.role } }, select: { id: true },
  });
  if (!workspace) throw new AuthError("ACCOUNT_INACTIVE");
  const activeSession = await tx.session.findFirst({
    where: { id: session.session.id, userId: session.user.id, expiresAt: { gt: new Date() } }, select: { id: true },
  });
  if (!activeSession) throw new AuthError("UNAUTHENTICATED");
}

export function isRetryableRecordConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error.code === "P2034" || error.code === "P2002");
}
