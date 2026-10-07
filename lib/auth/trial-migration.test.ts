import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260909213000_trial_activation",
    "migration.sql",
  ),
  "utf8",
).replace(/\s+/g, " ");

const reissueMigration = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260910143000_temporary_credential_reissue",
    "migration.sql",
  ),
  "utf8",
).replace(/\s+/g, " ");

const adminProfileMigration = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260910210000_admin_profiles",
    "migration.sql",
  ),
  "utf8",
).replace(/\s+/g, " ");

describe("trial activation migration invariants", () => {
  it("requires trial activation and expiration timestamps to be absent or present together", () => {
    expect(migration).toContain(
      '"trial_activated_at" IS NULL AND "trial_expires_at" IS NULL',
    );
    expect(migration).toContain(
      '"trial_activated_at" IS NOT NULL AND "trial_expires_at" IS NOT NULL',
    );
  });

  it("distinguishes first activation from recovery without rewriting trial dates", () => {
    expect(migration).toContain("'ACTIVATION'::\"TemporaryPasswordPurpose\"");
    expect(migration).toContain("'RECOVERY'::\"TemporaryPasswordPurpose\"");
    expect(migration).toContain('"temporary_password_purpose" IS NOT NULL');
  });

  it("grandfathers every pre-migration account", () => {
    expect(migration).toContain(
      'SET "temporary_password_change_required" = false',
    );
  });
});

describe("temporary credential reissue migration invariants", () => {
  it("stores operation/version proof without a credential or hash column", () => {
    expect(reissueMigration).toContain('"operation_id" UUID NOT NULL');
    expect(reissueMigration).toContain(
      'UNIQUE INDEX "temporary_credential_issuances_operation_id_key"',
    );
    expect(reissueMigration).toContain(
      'UNIQUE INDEX "temporary_credential_issuances_target_user_id_version_key"',
    );
    expect(reissueMigration).not.toMatch(/"(?:password|secret|credential_hash)"/i);
  });

  it("allows only one prepared or issued row per target", () => {
    expect(reissueMigration).toContain(
      'UNIQUE INDEX "temporary_credential_one_current_per_target_idx"',
    );
    expect(reissueMigration).toContain(
      'WHERE "status" IN ( \'PREPARED\'::"TemporaryCredentialIssuanceStatus", \'ISSUED\'::"TemporaryCredentialIssuanceStatus" )',
    );
  });

  it("enforces structured notes, delivery tuples, expiry, and lifecycle timestamps", () => {
    expect(reissueMigration).toContain(
      'CONSTRAINT "temporary_credential_reason_note_check"',
    );
    expect(reissueMigration).toContain(
      'CONSTRAINT "temporary_credential_delivery_tuple_check"',
    );
    expect(reissueMigration).toContain(
      'CONSTRAINT "temporary_credential_issued_expiry_check"',
    );
    expect(reissueMigration).toContain(
      'CONSTRAINT "temporary_credential_lifecycle_check"',
    );
  });
});

describe("administrative profile migration invariants", () => {
  it("keeps profiles separate from general roles and permits explicit bootstrap", () => {
    expect(adminProfileMigration).toContain('ADD COLUMN "admin_profile" "AdminProfile"');
    expect(adminProfileMigration).toContain('"admin_profile" IS NULL OR "role" = \'PLATFORM_ADMIN\'::"AppRole"');
    expect(adminProfileMigration).not.toContain("UPDATE \"users\"");
  });

  it("enforces one owner and idempotent profile operations", () => {
    expect(adminProfileMigration).toContain('UNIQUE INDEX "users_single_owner_idx"');
    expect(adminProfileMigration).toContain('WHERE "admin_profile" = \'OWNER\'::"AdminProfile"');
    expect(adminProfileMigration).toContain('UNIQUE INDEX "admin_profile_mutations_operation_id_key"');
  });

  it("versions settings and validates profile transitions", () => {
    expect(adminProfileMigration).toContain('ALTER TABLE "platform_settings" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0');
    expect(adminProfileMigration).toContain('CONSTRAINT "admin_profile_mutations_transition_check"');
    expect(adminProfileMigration).toContain('CONSTRAINT "platform_settings_version_check"');
  });
});
