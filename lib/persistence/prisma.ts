import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured before using Prisma.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    // Services log safe codes/names. Prisma's automatic error output can include
    // invocation arguments, which now contain client contact details and notes.
    log: [],
  });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Reuse the client during Next.js development reloads to avoid extra pools.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { prisma };
export default prisma;
