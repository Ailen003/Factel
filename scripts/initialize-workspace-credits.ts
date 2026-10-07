import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/persistence/generated/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be configured.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }), log: [] });

async function main(): Promise<void> {
  const workspaces = await prisma.workspace.findMany({
    where: { creditInitializedAt: null, lifecycle: "ACTIVE" },
    select: { id: true, owner: { select: { initialCreditAllocation: true } } },
    orderBy: { id: "asc" },
  });
  let initialized = 0;
  for (const workspace of workspaces) {
    const changed = await prisma.$transaction(async (tx) => {
      const claimed = await tx.workspace.updateMany({
        where: { id: workspace.id, creditInitializedAt: null },
        data: { creditInitializedAt: new Date() },
      });
      if (claimed.count !== 1) return false;
      if (workspace.owner.initialCreditAllocation > 0) {
        await tx.creditEntry.create({
          data: {
            workspaceId: workspace.id,
            kind: "GRANT",
            quantity: workspace.owner.initialCreditAllocation,
            reason: "INITIAL_ALLOCATION",
            operationKey: `workspace-credit-initialization:${workspace.id}`,
          },
        });
      }
      return true;
    }, { isolationLevel: "Serializable" });
    if (changed) initialized++;
  }
  console.info(`Initialized credit ledgers for ${initialized} workspace(s).`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error("Workspace credit initialization failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    process.exitCode = 1;
  });
