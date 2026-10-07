/** Real services and transactions against an exclusively owned temporary LOCAL database.
 * Run: node scripts/verify-reprocessing-integration.mjs
 * Never connects to or modifies the configured application's database.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { register } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: [path.join(root, ".env.local"), path.join(root, ".env")], quiet: true });
assert(process.env.DATABASE_URL, "Local PostgreSQL credentials are required");
const configured = new URL(process.env.DATABASE_URL);
assert(["localhost", "127.0.0.1", "[::1]"].includes(configured.hostname), "Only local PostgreSQL is permitted");
assert(["postgres:", "postgresql:"].includes(configured.protocol));
const databaseName = `reprocessing_verify_${randomUUID().replaceAll("-", "")}`;
assert(/^reprocessing_verify_[a-f0-9]{32}$/.test(databaseName));
assert.notEqual(decodeURIComponent(configured.pathname.slice(1)), databaseName);
const adminUrl = new URL(configured); adminUrl.pathname = "/postgres";
const temporaryUrl = new URL(configured); temporaryUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.href });
const db = new pg.Client({ connectionString: temporaryUrl.href });
let created = false;
let connected = false;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  await db.connect(); connected = true;
  assert.equal((await db.query("SELECT current_database() AS name")).rows[0].name, databaseName);
  const migrationsRoot = path.join(root, "prisma", "migrations");
  for (const name of (await readdir(migrationsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
    await db.query(await readFile(path.join(migrationsRoot, name, "migration.sql"), "utf8"));
  }
  console.log("PASS all migrations apply to an isolated empty database");
  process.env.DATABASE_URL = temporaryUrl.href;
  process.env.CONVERSATION_EXTRACTION_ENABLED = "true";
  process.env.GROQ_API_KEY = "synthetic-integration-never-sent";
  // This process cannot contact providers, even if a service accidentally dispatches.
  globalThis.fetch = async () => { throw new Error("Integration network access is forbidden"); };
  register("./reprocessing-integration-loader.mjs", import.meta.url);
  const { verifyReprocessing } = await import("./reprocessing-integration-worker.ts");
  await verifyReprocessing(db);
} catch (error) {
  // Driver messages and assertion values can contain inputs: print only safe codes.
  console.error("Reprocessing integration failed", { name: error?.name, code: error?.code });
  process.exitCode = 1;
} finally {
  if (connected) await db.end();
  if (created) {
    assert(/^reprocessing_verify_[a-f0-9]{32}$/.test(databaseName));
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    console.log("Removed temporary database; configured application database was untouched.");
  }
  await admin.end();
}
