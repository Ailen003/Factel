-- Existing accounts are deliberately grandfathered: the new timestamps remain
-- NULL and their existing temporary-password flag remains false. Application
-- provisioning fills these fields only for newly created trial accounts.
CREATE TYPE "TemporaryPasswordPurpose" AS ENUM ('ACTIVATION', 'RECOVERY');

ALTER TABLE "users"
  ADD COLUMN "temporary_password_expires_at" TIMESTAMP(3),
  ADD COLUMN "temporary_password_purpose" "TemporaryPasswordPurpose",
  ADD COLUMN "trial_activated_at" TIMESTAMP(3),
  ADD COLUMN "trial_expires_at" TIMESTAMP(3);

-- The pre-migration population is deliberately active/grandfathered, even if
-- an earlier manual edit set the legacy flag without the new state fields.
UPDATE "users"
SET "temporary_password_change_required" = false
WHERE "temporary_password_change_required" = true;

ALTER TABLE "users"
  ADD CONSTRAINT "users_temporary_password_state_check"
  CHECK (
    (
      "temporary_password_change_required" = true
      AND "temporary_password_expires_at" IS NOT NULL
      AND "temporary_password_purpose" IS NOT NULL
    )
    OR (
      "temporary_password_change_required" = false
      AND "temporary_password_expires_at" IS NULL
      AND "temporary_password_purpose" IS NULL
    )
  ),
  ADD CONSTRAINT "users_trial_timestamp_pair_check"
  CHECK (
    (
      "trial_activated_at" IS NULL
      AND "trial_expires_at" IS NULL
    )
    OR (
      "trial_activated_at" IS NOT NULL
      AND "trial_expires_at" IS NOT NULL
      AND "trial_expires_at" > "trial_activated_at"
    )
  ),
  ADD CONSTRAINT "users_temporary_password_purpose_check"
  CHECK (
    (
      "temporary_password_purpose" IS DISTINCT FROM 'ACTIVATION'::"TemporaryPasswordPurpose"
      OR (
        "trial_activated_at" IS NULL
        AND "trial_expires_at" IS NULL
      )
    )
    AND (
      "temporary_password_purpose" IS DISTINCT FROM 'RECOVERY'::"TemporaryPasswordPurpose"
      OR (
        "trial_activated_at" IS NOT NULL
        AND "trial_expires_at" IS NOT NULL
      )
    )
  );

CREATE INDEX "users_temporary_password_change_required_temporary_password_expires_at_idx"
  ON "users"("temporary_password_change_required", "temporary_password_expires_at");

CREATE INDEX "users_trial_expires_at_idx" ON "users"("trial_expires_at");
