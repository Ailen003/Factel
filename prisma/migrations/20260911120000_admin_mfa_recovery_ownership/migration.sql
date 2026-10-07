-- H2C-2b is additive. Rollback after use must be a reviewed forward repair:
-- disable the H2C-2b application paths, preserve/export the secret-free ledgers,
-- verify that no transfer is pending, then remove constraints/tables in a
-- separate migration. Never restore deleted MFA factors or revoked sessions.

ALTER TYPE "AdminProfileMutationKind" ADD VALUE 'TRANSFER_PROMOTE_OWNER';
ALTER TYPE "AdminProfileMutationKind" ADD VALUE 'TRANSFER_DEMOTE_OWNER';

-- Extend the existing transition ledger invariant for the two atomic sides of
-- an ownership swap. Existing rows keep the same accepted shapes.
ALTER TABLE "admin_profile_mutations"
  DROP CONSTRAINT "admin_profile_mutations_transition_check";

ALTER TABLE "admin_profile_mutations"
  ADD CONSTRAINT "admin_profile_mutations_transition_check" CHECK (
    (
      "kind" = 'PROMOTE_OPERATOR'::"AdminProfileMutationKind"
      AND "from_role" = 'TRIAL_USER'::"AppRole"
      AND "from_admin_profile" IS NULL
      AND "to_role" = 'PLATFORM_ADMIN'::"AppRole"
      AND "to_admin_profile" = 'OPERATOR'::"AdminProfile"
    )
    OR (
      "kind" = 'DEMOTE_OPERATOR'::"AdminProfileMutationKind"
      AND "from_role" = 'PLATFORM_ADMIN'::"AppRole"
      AND "from_admin_profile" = 'OPERATOR'::"AdminProfile"
      AND "to_role" = 'TRIAL_USER'::"AppRole"
      AND "to_admin_profile" IS NULL
    )
    OR (
      "kind" = 'BOOTSTRAP_OWNER'::"AdminProfileMutationKind"
      AND "from_role" = 'PLATFORM_ADMIN'::"AppRole"
      AND ("from_admin_profile" IS NULL OR "from_admin_profile" = 'OPERATOR'::"AdminProfile")
      AND "to_role" = 'PLATFORM_ADMIN'::"AppRole"
      AND "to_admin_profile" = 'OWNER'::"AdminProfile"
    )
    OR (
      "kind" = 'BOOTSTRAP_OPERATOR'::"AdminProfileMutationKind"
      AND "from_role" = 'PLATFORM_ADMIN'::"AppRole"
      AND "from_admin_profile" IS NULL
      AND "to_role" = 'PLATFORM_ADMIN'::"AppRole"
      AND "to_admin_profile" = 'OPERATOR'::"AdminProfile"
    )
    OR (
      "kind" = 'TRANSFER_PROMOTE_OWNER'::"AdminProfileMutationKind"
      AND "from_role" = 'PLATFORM_ADMIN'::"AppRole"
      AND "from_admin_profile" = 'OPERATOR'::"AdminProfile"
      AND "to_role" = 'PLATFORM_ADMIN'::"AppRole"
      AND "to_admin_profile" = 'OWNER'::"AdminProfile"
    )
    OR (
      "kind" = 'TRANSFER_DEMOTE_OWNER'::"AdminProfileMutationKind"
      AND "from_role" = 'PLATFORM_ADMIN'::"AppRole"
      AND "from_admin_profile" = 'OWNER'::"AdminProfile"
      AND "to_role" = 'PLATFORM_ADMIN'::"AppRole"
      AND "to_admin_profile" = 'OPERATOR'::"AdminProfile"
    )
  );

CREATE TYPE "AdminSecurityOperationKind" AS ENUM (
  'OPERATOR_MFA_RECOVERY',
  'OWNER_MFA_BREAK_GLASS',
  'OWNERSHIP_TRANSFER_INITIATE',
  'OWNERSHIP_TRANSFER_CANCEL',
  'OWNERSHIP_TRANSFER_DECLINE',
  'OWNERSHIP_TRANSFER_ACCEPT',
  'OWNERSHIP_TRANSFER_EXPIRE'
);

CREATE TYPE "AdminSecurityOperationStatus" AS ENUM (
  'PENDING',
  'SUCCEEDED',
  'DENIED',
  'FAILED'
);

CREATE TYPE "MfaRecoveryReason" AS ENUM (
  'LOST_ALL_FACTORS',
  'LOST_DEVICE',
  'SUSPECTED_COMPROMISE',
  'OPERATIONAL_RECOVERY',
  'OTHER'
);

CREATE TYPE "OwnershipTransferStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'CANCELLED',
  'EXPIRED',
  'INVALIDATED'
);

CREATE TABLE "ownership_transfers" (
  "id" TEXT NOT NULL,
  "initiated_operation_id" UUID NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "target_user_id" TEXT NOT NULL,
  "owner_version" INTEGER NOT NULL,
  "target_version" INTEGER NOT NULL,
  "status" "OwnershipTransferStatus" NOT NULL DEFAULT 'PENDING',
  "pending_key" VARCHAR(32) DEFAULT 'ownership',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),

  CONSTRAINT "ownership_transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ownership_transfers_distinct_participants_check"
    CHECK ("owner_user_id" <> "target_user_id"),
  CONSTRAINT "ownership_transfers_versions_check"
    CHECK ("owner_version" >= 0 AND "target_version" >= 0),
  CONSTRAINT "ownership_transfers_expiry_check"
    CHECK ("expires_at" > "initiated_at"),
  CONSTRAINT "ownership_transfers_pending_state_check" CHECK (
    (
      "status" = 'PENDING'
      AND "pending_key" = 'ownership'
      AND "resolved_at" IS NULL
    ) OR (
      "status" <> 'PENDING'
      AND "pending_key" IS NULL
      AND "resolved_at" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "ownership_transfers_initiated_operation_id_key"
  ON "ownership_transfers" ("initiated_operation_id");
CREATE UNIQUE INDEX "ownership_transfers_pending_key_key"
  ON "ownership_transfers" ("pending_key");
CREATE INDEX "ownership_transfers_status_expires_idx"
  ON "ownership_transfers" ("status", "expires_at");
CREATE INDEX "ownership_transfers_owner_created_idx"
  ON "ownership_transfers" ("owner_user_id", "initiated_at");
CREATE INDEX "ownership_transfers_target_created_idx"
  ON "ownership_transfers" ("target_user_id", "initiated_at");

ALTER TABLE "ownership_transfers"
  ADD CONSTRAINT "ownership_transfers_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ownership_transfers_target_user_id_fkey"
    FOREIGN KEY ("target_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "admin_security_operations" (
  "id" TEXT NOT NULL,
  "operation_id" UUID NOT NULL,
  "kind" "AdminSecurityOperationKind" NOT NULL,
  "parameter_fingerprint" VARCHAR(64) NOT NULL,
  "actor_user_id" TEXT,
  "target_user_id" TEXT,
  "ownership_transfer_id" TEXT,
  "recovery_reason" "MfaRecoveryReason",
  "operational_reference" VARCHAR(120),
  "expected_actor_version" INTEGER,
  "expected_target_version" INTEGER,
  "committed_actor_version" INTEGER,
  "committed_target_version" INTEGER,
  "status" "AdminSecurityOperationStatus" NOT NULL DEFAULT 'PENDING',
  "safe_failure_code" VARCHAR(64),
  "revoked_actor_sessions" INTEGER NOT NULL DEFAULT 0,
  "revoked_target_sessions" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "admin_security_operations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_security_operations_versions_check" CHECK (
    ("expected_actor_version" IS NULL OR "expected_actor_version" >= 0)
    AND ("expected_target_version" IS NULL OR "expected_target_version" >= 0)
    AND ("committed_actor_version" IS NULL OR "committed_actor_version" >= 0)
    AND ("committed_target_version" IS NULL OR "committed_target_version" >= 0)
  ),
  CONSTRAINT "admin_security_operations_sessions_check" CHECK (
    "revoked_actor_sessions" >= 0 AND "revoked_target_sessions" >= 0
  ),
  CONSTRAINT "admin_security_operations_completion_check" CHECK (
    ("status" = 'PENDING' AND "completed_at" IS NULL AND "safe_failure_code" IS NULL)
    OR ("status" = 'SUCCEEDED' AND "completed_at" IS NOT NULL AND "safe_failure_code" IS NULL)
    OR ("status" IN ('DENIED', 'FAILED') AND "completed_at" IS NOT NULL AND "safe_failure_code" IS NOT NULL)
  ),
  CONSTRAINT "admin_security_operations_recovery_shape_check" CHECK (
    (
      "kind" IN ('OPERATOR_MFA_RECOVERY', 'OWNER_MFA_BREAK_GLASS')
      AND "recovery_reason" IS NOT NULL
      AND "ownership_transfer_id" IS NULL
    ) OR (
      "kind" NOT IN ('OPERATOR_MFA_RECOVERY', 'OWNER_MFA_BREAK_GLASS')
      AND "recovery_reason" IS NULL
      AND "operational_reference" IS NULL
      AND (
        "ownership_transfer_id" IS NOT NULL
        OR "status" IN ('DENIED', 'FAILED')
      )
    )
  )
);

CREATE UNIQUE INDEX "admin_security_operations_operation_id_key"
  ON "admin_security_operations" ("operation_id");
CREATE INDEX "admin_security_operations_target_kind_created_idx"
  ON "admin_security_operations" ("target_user_id", "kind", "created_at");
CREATE INDEX "admin_security_operations_actor_created_idx"
  ON "admin_security_operations" ("actor_user_id", "created_at");
CREATE INDEX "admin_security_operations_transfer_created_idx"
  ON "admin_security_operations" ("ownership_transfer_id", "created_at");

ALTER TABLE "admin_security_operations"
  ADD CONSTRAINT "admin_security_operations_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "admin_security_operations_target_user_id_fkey"
    FOREIGN KEY ("target_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "admin_security_operations_ownership_transfer_id_fkey"
    FOREIGN KEY ("ownership_transfer_id") REFERENCES "ownership_transfers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
