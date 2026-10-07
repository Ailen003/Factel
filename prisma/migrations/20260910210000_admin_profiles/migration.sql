CREATE TYPE "AdminProfile" AS ENUM ('OWNER', 'OPERATOR');

CREATE TYPE "AdminProfileMutationKind" AS ENUM (
  'PROMOTE_OPERATOR',
  'DEMOTE_OPERATOR',
  'BOOTSTRAP_OWNER',
  'BOOTSTRAP_OPERATOR'
);

ALTER TABLE "users"
  ADD COLUMN "admin_profile" "AdminProfile",
  ADD COLUMN "admin_profile_version" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "users_admin_profile_role_check" CHECK (
    "admin_profile" IS NULL
    OR "role" = 'PLATFORM_ADMIN'::"AppRole"
  ),
  ADD CONSTRAINT "users_admin_profile_version_check" CHECK (
    "admin_profile_version" >= 0
  );

CREATE UNIQUE INDEX "users_single_owner_idx"
  ON "users" ("admin_profile")
  WHERE "admin_profile" = 'OWNER'::"AdminProfile";
CREATE INDEX "users_admin_profile_status_idx"
  ON "users" ("admin_profile", "status");

ALTER TABLE "platform_settings"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "platform_settings_version_check" CHECK ("version" >= 0);

CREATE TABLE "admin_profile_mutations" (
  "id" TEXT NOT NULL,
  "operation_id" UUID NOT NULL,
  "kind" "AdminProfileMutationKind" NOT NULL,
  "target_user_id" TEXT,
  "initiated_by_user_id" TEXT,
  "from_role" "AppRole" NOT NULL,
  "from_admin_profile" "AdminProfile",
  "to_role" "AppRole" NOT NULL,
  "to_admin_profile" "AdminProfile",
  "target_version" INTEGER NOT NULL,
  "revoked_sessions" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_profile_mutations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_profile_mutations_target_version_check" CHECK (
    "target_version" > 0
  ),
  CONSTRAINT "admin_profile_mutations_revoked_sessions_check" CHECK (
    "revoked_sessions" >= 0
  ),
  CONSTRAINT "admin_profile_mutations_transition_check" CHECK (
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
  )
);

CREATE UNIQUE INDEX "admin_profile_mutations_operation_id_key"
  ON "admin_profile_mutations" ("operation_id");
CREATE INDEX "admin_profile_mutations_target_created_idx"
  ON "admin_profile_mutations" ("target_user_id", "created_at");
CREATE INDEX "admin_profile_mutations_initiator_created_idx"
  ON "admin_profile_mutations" ("initiated_by_user_id", "created_at");

ALTER TABLE "admin_profile_mutations"
  ADD CONSTRAINT "admin_profile_mutations_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "admin_profile_mutations_initiated_by_user_id_fkey"
  FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
