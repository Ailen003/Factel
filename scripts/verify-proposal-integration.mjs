/**
 * Integration checks against an exclusively owned temporary LOCAL database.
 * Run: node scripts/verify-proposal-integration.mjs
 * Reads connection credentials, but never connects to or modifies DATABASE_URL's database.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: [path.join(root, ".env.local"), path.join(root, ".env")], quiet: true });
assert(process.env.DATABASE_URL, "DATABASE_URL is required to obtain local credentials");
const configured = new URL(process.env.DATABASE_URL);
assert(["localhost", "127.0.0.1", "[::1]"].includes(configured.hostname), "Only a local PostgreSQL host is permitted");
assert(["postgres:", "postgresql:"].includes(configured.protocol), "Expected PostgreSQL URL");
const databaseName = `proposal_verify_${randomUUID().replaceAll("-", "")}`;
assert(/^proposal_verify_[a-f0-9]{32}$/.test(databaseName));
assert.notEqual(decodeURIComponent(configured.pathname.slice(1)), databaseName);
const adminUrl = new URL(configured); adminUrl.pathname = "/postgres";
const testUrl = new URL(configured); testUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.href });
const db = new pg.Client({ connectionString: testUrl.href });
let created = false;
let connected = false;
let checks = 0;
async function check(label, work) {
  await work(); checks++;
  console.log(`PASS ${label}`);
}
async function rejectsSql(sql, pattern) {
  await assert.rejects(db.query(sql), pattern);
}
const insertRevision = (id, conversationId, number, extra = "", extraValues = "") => db.query(`
  INSERT INTO proposal_revisions (id,workspace_id,conversation_id,revision_number,transcript_id,
    schema_version,task_profile_version,prompt_version,policy_version,author_kind${extra})
  VALUES ('${id}','w','${conversationId}',${number},'t-${conversationId}','1','1','1','1','HUMAN'${extraValues})`);
async function addDrafts(revisionId) {
  await db.query(`INSERT INTO proposal_client_drafts (id,workspace_id,revision_id,stable_item_id,name)
    VALUES ($1,'w',$2,'client','Ada')`, [`client-${revisionId}`, revisionId]);
  await db.query(`INSERT INTO proposal_request_items (id,workspace_id,revision_id,stable_item_id,display_order)
    VALUES ($1,'w',$2,'item-1',0)`, [`item-${revisionId}`, revisionId]);
}

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  await db.connect(); connected = true;
  const migrationsRoot = path.join(root, "prisma", "migrations");
  for (const name of (await readdir(migrationsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
    await db.query(await readFile(path.join(migrationsRoot, name, "migration.sql"), "utf8"));
  }
  await check("all migrations apply to an empty isolated database", async () => {
    assert.equal((await db.query("SELECT current_database() AS name")).rows[0].name, databaseName);
  });
  await db.query(`
    INSERT INTO users (id,email,name,updated_at) VALUES ('u','integration@example.com','Integration',now());
    INSERT INTO workspaces (id,owner_id,updated_at) VALUES ('w','u',now());
    INSERT INTO conversations (id,workspace_id,source_type,locale,correlation_id,updated_at)
      VALUES ('c1','w','UPLOAD','EN','trace1',now()),('c2','w','UPLOAD','ES','trace2',now());
    INSERT INTO processing_runs (id,workspace_id,conversation_id,idempotency_key,correlation_id)
      VALUES ('run-c1','w','c1','run1','trace1'),('run-c2','w','c2','run2','trace2');
    INSERT INTO original_transcripts (id,workspace_id,conversation_id,processing_run_id,text,language,finalized_at,content_fingerprint)
      VALUES ('t-c1','w','c1','run-c1','Ada','EN',now(),'fingerprint1'),('t-c2','w','c2','run-c2','Otro','ES',now(),'fingerprint2');
    INSERT INTO transcript_evidence (id,workspace_id,transcript_id,stable_evidence_id,start_offset,end_offset)
      VALUES ('e1','w','t-c1','segment1',0,3),('e2','w','t-c2','segment1',0,4);
    INSERT INTO credit_reservations (id,workspace_id,processing_run_id,quantity,operation_key)
      VALUES ('reservation1','w','run-c1',1,'reservation1');
  `);
  await insertRevision("r1", "c1", 1); await addDrafts("r1");
  await insertRevision("r2", "c1", 2, ",parent_revision_id", ",'r1'"); await addDrafts("r2");
  await insertRevision("foreign", "c2", 1); await addDrafts("foreign");
  await db.query(`INSERT INTO proposal_fields (id,workspace_id,revision_id,target,field_key,provenance,observed_value,normalized_value)
    VALUES ('f1','w','r1','CLIENT','name','EXTRACTED','Ada','Ada'),('manual','w','r1','CLIENT','email','MANUAL',null,'ada@example.com')`);

  await check("proposal transcript and parent must belong to the same conversation", async () => {
    await rejectsSql("UPDATE proposal_revisions SET transcript_id='t-c2' WHERE id='r1'", /proposal transcript scope mismatch/);
    await rejectsSql("UPDATE proposal_revisions SET parent_revision_id='foreign' WHERE id='r2'", /proposal parent scope mismatch/);
    await rejectsSql("UPDATE proposal_revisions SET producing_run_id='run-c2' WHERE id='r1'", /proposal run scope mismatch/);
  });
  await check("evidence references cannot cross transcripts or claim manual speech", async () => {
    await rejectsSql("INSERT INTO proposal_field_evidence (proposal_field_id,evidence_id,workspace_id) VALUES ('f1','e2','w')", /proposal evidence transcript mismatch/);
    await rejectsSql("INSERT INTO proposal_field_evidence (proposal_field_id,evidence_id,workspace_id) VALUES ('manual','e1','w')", /manual and default values cannot claim speech evidence/);
    await db.query("INSERT INTO proposal_field_evidence (proposal_field_id,evidence_id,workspace_id) VALUES ('f1','e1','w')");
  });
  await check("fields and findings cannot cross revision boundaries", async () => {
    await rejectsSql("INSERT INTO proposal_fields (id,workspace_id,revision_id,target,request_item_id,field_key,provenance) VALUES ('bad','w','r1','REQUEST','item-r2','title','MANUAL')", /proposal item revision mismatch/);
    await rejectsSql("INSERT INTO proposal_findings (id,workspace_id,revision_id,field_id,code,severity) VALUES ('bad','w','r2','f1','AMBIGUITY','BLOCKING')", /proposal finding revision mismatch/);
    await rejectsSql("UPDATE proposal_fields SET revision_id='r2' WHERE id='f1'", /proposal content cannot move revisions/);
  });
  await check("client fields are unique even when request item is NULL", async () => {
    await rejectsSql("INSERT INTO proposal_fields (id,workspace_id,revision_id,target,field_key,provenance) VALUES ('duplicate','w','r1','CLIENT','name','MANUAL')", /proposal_fields_unique_client_field/);
  });
  await check("a current proposal must be sealed and in its own conversation", async () => {
    await rejectsSql("UPDATE conversations SET current_proposal_revision_id='r1' WHERE id='c1'", /current proposal must be a sealed revision/);
    await db.query("UPDATE proposal_revisions SET sealed_at=now() WHERE id IN ('r1','r2','foreign')");
    await rejectsSql("UPDATE conversations SET current_proposal_revision_id='foreign' WHERE id='c1'", /current proposal must be a sealed revision/);
    await db.query("UPDATE conversations SET current_proposal_revision_id='r2' WHERE id='c1'");
  });
  await check("published content, metadata and references are immutable", async () => {
    await rejectsSql("UPDATE proposal_client_drafts SET name='Changed' WHERE revision_id='r1'", /published proposal content is immutable/);
    await rejectsSql("DELETE FROM proposal_field_evidence WHERE proposal_field_id='f1'", /published proposal content is immutable/);
    await rejectsSql("UPDATE proposal_revisions SET validation_summary='{}' WHERE id='r1'", /published revision is immutable/);
    await rejectsSql("DELETE FROM proposal_revisions WHERE id='foreign'", /published revision is immutable/);
    await db.query("UPDATE proposal_revisions SET status='READY',ready_at=now(),ready_by_user_id='u' WHERE id='r2'");
  });
  await check("failed proposal publication rolls back settlement and ledger together", async () => {
    await db.query("BEGIN");
    try {
      await db.query("UPDATE credit_reservations SET status='CONSUMED' WHERE id='reservation1'");
      await db.query("INSERT INTO credit_entries (id,workspace_id,kind,quantity,reservation_id,processing_run_id,operation_key) VALUES ('entry-rollback','w','CONSUME',1,'reservation1','run-c1','consume-rollback')");
      await assert.rejects(db.query("UPDATE proposal_revisions SET prompt_version='invalid' WHERE id='r1'"), /published revision is immutable/);
    } finally { await db.query("ROLLBACK"); }
    assert.equal((await db.query("SELECT status FROM credit_reservations WHERE id='reservation1'")).rows[0].status, "ACTIVE");
    assert.equal((await db.query("SELECT count(*)::int AS count FROM credit_entries")).rows[0].count, 0);
  });
  await check("concurrent settlement inserts produce exactly one durable ledger entry", async () => {
    const peer = new pg.Client({ connectionString: testUrl.href });
    await peer.connect();
    try {
      const insert = (client, id, kind) => client.query("INSERT INTO credit_entries (id,workspace_id,kind,quantity,reservation_id,processing_run_id,operation_key) VALUES ($1,'w',$2,1,'reservation1','run-c1',$1)", [id, kind]);
      const outcomes = await Promise.allSettled([insert(db, "settle-consume", "CONSUME"), insert(peer, "settle-restore", "RESTORE")]);
      assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
      const failure = outcomes.find((outcome) => outcome.status === "rejected");
      assert.equal(failure.reason.code, "23505");
      assert.equal((await db.query("SELECT count(*)::int AS count FROM credit_entries WHERE reservation_id='reservation1'")).rows[0].count, 1);
    } finally { await peer.end(); }
  });
  await check("recoverable deletion permits removing all revision generations and evidence links", async () => {
    await db.query("UPDATE conversations SET deletion_state='DELETE_REQUESTED',current_proposal_revision_id=null WHERE id='c1'");
    await db.query("DELETE FROM proposal_field_evidence WHERE proposal_field_id IN (SELECT id FROM proposal_fields WHERE revision_id IN ('r1','r2'))");
    await db.query("DELETE FROM proposal_findings WHERE revision_id IN ('r1','r2')");
    await db.query("DELETE FROM proposal_fields WHERE revision_id IN ('r1','r2')");
    await db.query("DELETE FROM proposal_request_items WHERE revision_id IN ('r1','r2')");
    await db.query("DELETE FROM proposal_client_drafts WHERE revision_id IN ('r1','r2')");
    // Same single bulk delete used by the service, including the parent/child FK.
    await db.query("DELETE FROM proposal_revisions WHERE conversation_id='c1'");
    assert.equal((await db.query("SELECT count(*)::int AS count FROM proposal_revisions WHERE conversation_id='c1'")).rows[0].count, 0);
    assert.equal((await db.query("SELECT text FROM original_transcripts WHERE id='t-c1'")).rows[0].text, "Ada");
  });
  console.log(`PASS ${checks} integration checks`);
} catch (error) {
  // Do not print connection strings or SQL argument values.
  console.error("Proposal integration failed", { name: error?.name, code: error?.code, message: error?.message });
  process.exitCode = 1;
} finally {
  if (connected) await db.end();
  if (created) {
    assert(/^proposal_verify_[a-f0-9]{32}$/.test(databaseName));
    await admin.query(`DROP DATABASE "${databaseName}"`);
    console.log("Removed the temporary integration database; configured application database was untouched.");
  }
  await admin.end();
}
