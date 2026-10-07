#!/usr/bin/env node

import { validateRepository } from "./harness-validation.mjs";

async function main() {
  if (process.argv.length > 2) {
    throw new Error("Usage: pnpm validate:harness");
  }
  const errors = await validateRepository(process.cwd());
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  process.stdout.write("Harness validation passed.\n");
}

main().catch((error) => {
  process.stderr.write(`Harness validation failed:\n${error.message}\n`);
  process.exitCode = 1;
});
