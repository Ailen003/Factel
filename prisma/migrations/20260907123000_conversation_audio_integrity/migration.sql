-- Bind upload grants to the exact workspace-scoped artifact they authorize and
-- retain the private staging key needed for verification and cleanup.
ALTER TABLE "upload_grants"
  ADD COLUMN "staging_storage_key" TEXT,
  ADD COLUMN "declared_mime_type" VARCHAR(127),
  ADD COLUMN "declared_byte_size" BIGINT;

UPDATE "upload_grants"
SET "staging_storage_key" = 'legacy-upload-grants/' || "id",
    "declared_mime_type" = 'application/octet-stream',
    "declared_byte_size" = "maximum_bytes"
WHERE "staging_storage_key" IS NULL
   OR "declared_mime_type" IS NULL
   OR "declared_byte_size" IS NULL;

ALTER TABLE "upload_grants"
  ALTER COLUMN "staging_storage_key" SET NOT NULL,
  ALTER COLUMN "declared_mime_type" SET NOT NULL,
  ALTER COLUMN "declared_byte_size" SET NOT NULL;

CREATE UNIQUE INDEX "audio_artifacts_id_workspace_id_key"
  ON "audio_artifacts"("id", "workspace_id");

CREATE UNIQUE INDEX "upload_grants_staging_storage_key_key"
  ON "upload_grants"("staging_storage_key");

CREATE UNIQUE INDEX "upload_grants_expected_artifact_id_workspace_id_key"
  ON "upload_grants"("expected_artifact_id", "workspace_id");

ALTER TABLE "upload_grants"
  ADD CONSTRAINT "upload_grants_expected_artifact_id_workspace_id_fkey"
  FOREIGN KEY ("expected_artifact_id", "workspace_id")
  REFERENCES "audio_artifacts"("id", "workspace_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audio_artifacts"
  ADD CONSTRAINT "audio_artifacts_byte_size_nonnegative_check"
  CHECK ("byte_size" IS NULL OR "byte_size" >= 0),
  ADD CONSTRAINT "audio_artifacts_duration_ms_positive_check"
  CHECK ("duration_ms" IS NULL OR "duration_ms" > 0);

ALTER TABLE "upload_grants"
  ADD CONSTRAINT "upload_grants_maximum_bytes_positive_check"
  CHECK ("maximum_bytes" > 0),
  ADD CONSTRAINT "upload_grants_declared_byte_size_positive_check"
  CHECK ("declared_byte_size" > 0 AND "declared_byte_size" <= "maximum_bytes"),
  ADD CONSTRAINT "upload_grants_completion_order_check"
  CHECK (
    ("consumed_at" IS NULL OR "completed_at" IS NOT NULL)
    AND ("completed_at" IS NULL OR "completed_at" >= "created_at")
    AND ("consumed_at" IS NULL OR "consumed_at" >= "completed_at")
    AND "expires_at" > "created_at"
  );
