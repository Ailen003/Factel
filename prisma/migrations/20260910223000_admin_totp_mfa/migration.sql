-- Add the Better Auth 1.7.3 two-factor schema without enabling MFA for any
-- existing identity. Better Auth remains the sole owner of encrypted secrets
-- and encrypted backup-code payloads.
ALTER TABLE "users"
  ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "two_factor" (
  "id" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "backup_codes" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT true,
  "failed_verification_count" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMP(3),

  CONSTRAINT "two_factor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "two_factor_failed_verification_count_check"
    CHECK ("failed_verification_count" >= 0)
);

-- Better Auth expects indexed secret and user-id fields. This application
-- strengthens the latter to one enrollment record per identity.
CREATE INDEX "two_factor_secret_idx" ON "two_factor"("secret");
CREATE UNIQUE INDEX "two_factor_user_id_key" ON "two_factor"("user_id");

ALTER TABLE "two_factor"
  ADD CONSTRAINT "two_factor_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
