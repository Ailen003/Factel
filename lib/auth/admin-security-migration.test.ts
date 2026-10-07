import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("H2C-2b additive migration contract", () => {
  it("adds secret-free recovery/transfer ledgers and concurrency constraints", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma",
        "migrations",
        "20260911120000_admin_mfa_recovery_ownership",
        "migration.sql",
      ),
      "utf8",
    );

    expect(sql).toContain('CREATE TABLE "admin_security_operations"');
    expect(sql).toContain('CREATE TABLE "ownership_transfers"');
    expect(sql).toContain('CREATE UNIQUE INDEX "ownership_transfers_pending_key_key"');
    expect(sql).toContain('"owner_user_id" <> "target_user_id"');
    expect(sql).toContain('"operation_id" UUID NOT NULL');
    expect(sql).toContain('"parameter_fingerprint" VARCHAR(64) NOT NULL');
    expect(sql).toContain('OR "status" IN (\'DENIED\', \'FAILED\')');
    expect(sql).toContain('ALTER TYPE "AdminProfileMutationKind" ADD VALUE');
    expect(sql).toContain('DROP CONSTRAINT "admin_profile_mutations_transition_check"');
    expect(sql).toContain("'TRANSFER_PROMOTE_OWNER'::\"AdminProfileMutationKind\"");
    expect(sql).toContain("'TRANSFER_DEMOTE_OWNER'::\"AdminProfileMutationKind\"");
    expect(sql).toContain('"from_admin_profile" = \'OPERATOR\'::"AdminProfile"');
    expect(sql).toContain('"from_admin_profile" = \'OWNER\'::"AdminProfile"');
    expect(sql).not.toMatch(/\b(?:TRUNCATE|DELETE FROM|UPDATE "users"|DROP TABLE|DROP COLUMN)\b/i);
    expect(sql).not.toMatch(/password|backup_codes|cookie|token/i);
  });
});
