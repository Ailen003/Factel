import "dotenv/config";
import { randomUUID } from "node:crypto";
import { bootstrapInitialOwner } from "../lib/auth/owner-bootstrap.ts";
import { prisma } from "../lib/persistence/prisma.ts";

const args = process.argv.slice(2);
const allowed = new Set([
  "--email",
  "--dry-run",
  "--confirm",
  "--confirm-production",
]);
for (const argument of args) {
  if (argument.startsWith("--") && !allowed.has(argument)) {
    throw new Error(`Unknown option: ${argument}`);
  }
}

const emailIndex = args.indexOf("--email");
const email = emailIndex >= 0 ? args[emailIndex + 1] : undefined;
if (!email || email.startsWith("--")) {
  throw new Error("Provide the existing platform administrator with --email <address>.");
}

const confirmed = args.includes("--confirm");
if (confirmed && args.includes("--dry-run")) {
  throw new Error("Choose either --dry-run or --confirm, not both.");
}

try {
  const result = await bootstrapInitialOwner({
    email,
    dryRun: !confirmed,
    confirmed,
    productionConfirmed: args.includes("--confirm-production"),
    operationId: randomUUID(),
  });
  if (!result.success) {
    console.error(`Owner bootstrap refused: ${result.error.code}`);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      status: result.data.dryRun ? "dry-run" : "applied",
      idempotent: result.data.idempotent,
      ownerUserId: result.data.ownerUserId,
      operatorsAssigned: result.data.operatorsAssigned,
      sessionsRevoked: result.data.sessionsRevoked,
    }));
  }
} finally {
  await prisma.$disconnect();
}
