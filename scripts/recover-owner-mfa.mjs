import "dotenv/config";
import { recoverOwnerMfaBreakGlass } from "../lib/auth/owner-mfa-recovery.ts";
import { prisma } from "../lib/persistence/prisma.ts";

const args = process.argv.slice(2);
const valueOptions = new Set([
  "--email",
  "--operation-id",
  "--reason",
  "--reference",
]);
const flagOptions = new Set(["--dry-run", "--confirm", "--confirm-production"]);
const values = new Map();
const flags = new Set();

for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (valueOptions.has(argument)) {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
    values.set(argument, value);
    index += 1;
  } else if (flagOptions.has(argument)) {
    flags.add(argument);
  } else {
    throw new Error("Unknown option.");
  }
}

const dryRun = !flags.has("--confirm");
if (flags.has("--dry-run") && flags.has("--confirm")) {
  throw new Error("Choose either --dry-run or --confirm, not both.");
}

try {
  const result = await recoverOwnerMfaBreakGlass({
    email: values.get("--email"),
    operationId: values.get("--operation-id"),
    reason: values.get("--reason"),
    operationalReference: values.get("--reference"),
    dryRun,
    confirmed: flags.has("--confirm"),
    productionConfirmed: flags.has("--confirm-production"),
  });
  if (!result.success) {
    console.error(JSON.stringify({ status: "refused", code: result.error.code }));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      status: result.data.dryRun ? "dry-run" : "applied",
      eligibleOwnerCount: result.data.eligibleOwnerCount,
      ownerSelected: result.data.ownerSelected,
      wouldMutate: result.data.wouldMutate,
      replayed: result.data.replayed,
      revokedSessions: result.data.revokedSessions,
    }));
  }
} finally {
  await prisma.$disconnect();
}
