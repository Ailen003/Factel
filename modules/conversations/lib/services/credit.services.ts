import "server-only";

import type { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";

export interface CreditBalance {
  available: number;
  reserved: number;
  consumed: number;
}

export async function initializeWorkspaceCredits(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<boolean> {
  const workspace = await tx.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      creditInitializedAt: true,
      owner: { select: { initialCreditAllocation: true } },
    },
  });
  if (!workspace || workspace.creditInitializedAt) return false;
  const claimed = await tx.workspace.updateMany({
    where: { id: workspaceId, creditInitializedAt: null },
    data: { creditInitializedAt: new Date() },
  });
  if (claimed.count !== 1) return false;
  const quantity = workspace.owner.initialCreditAllocation;
  if (quantity > 0) {
    await tx.creditEntry.create({
      data: {
        workspaceId,
        kind: "GRANT",
        quantity,
        reason: "INITIAL_ALLOCATION",
        operationKey: `workspace-credit-initialization:${workspaceId}`,
      },
    });
  }
  return true;
}

export async function getWorkspaceCreditBalance(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<CreditBalance> {
  const [entries, activeReservations] = await Promise.all([
    tx.creditEntry.groupBy({
      by: ["kind"],
      where: { workspaceId, kind: { in: ["GRANT", "ADJUSTMENT", "CONSUME"] } },
      _sum: { quantity: true },
    }),
    tx.creditReservation.aggregate({
      where: { workspaceId, status: "ACTIVE" },
      _sum: { quantity: true },
    }),
  ]);
  const amount = (kind: "GRANT" | "ADJUSTMENT" | "CONSUME") =>
    entries.find((entry) => entry.kind === kind)?._sum.quantity ?? 0;
  const granted = amount("GRANT") + amount("ADJUSTMENT");
  const consumed = amount("CONSUME");
  const reserved = activeReservations._sum.quantity ?? 0;
  return { available: Math.max(0, granted - consumed - reserved), reserved, consumed };
}

export async function initializeExistingWorkspaceCredits(): Promise<number> {
  const workspaces = await prisma.workspace.findMany({
    where: { creditInitializedAt: null, lifecycle: "ACTIVE" },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  let initialized = 0;
  for (const workspace of workspaces) {
    const changed = await prisma.$transaction(
      (tx) => initializeWorkspaceCredits(tx, workspace.id),
      { isolationLevel: "Serializable" },
    );
    if (changed) initialized++;
  }
  return initialized;
}
