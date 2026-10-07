-- Add the durable transcription boundary without changing existing records.
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'TRANSCRIBED';

ALTER TABLE "workspaces"
  ADD COLUMN "credit_initialized_at" TIMESTAMP(3);

ALTER TABLE "processing_runs"
  ADD COLUMN "workflow_run_id" TEXT;

ALTER TABLE "provider_invocations"
  ADD COLUMN "provider_job_id" VARCHAR(191),
  ADD COLUMN "provider_updated_at" TIMESTAMP(3);

ALTER TABLE "outbox_events"
  ADD COLUMN "idempotency_key" TEXT;

UPDATE "outbox_events"
SET "idempotency_key" = 'legacy:' || "id"
WHERE "idempotency_key" IS NULL;

ALTER TABLE "outbox_events"
  ALTER COLUMN "idempotency_key" SET NOT NULL;

ALTER TABLE "cleanup_tasks"
  ADD COLUMN "provider_reference" VARCHAR(191);

CREATE UNIQUE INDEX "processing_runs_workflow_run_id_key"
  ON "processing_runs"("workflow_run_id");

CREATE UNIQUE INDEX "provider_invocations_processing_run_id_capability_key"
  ON "provider_invocations"("processing_run_id", "capability");

CREATE INDEX "provider_invocations_provider_alias_provider_job_id_idx"
  ON "provider_invocations"("provider_alias", "provider_job_id");

CREATE UNIQUE INDEX "outbox_events_idempotency_key_key"
  ON "outbox_events"("idempotency_key");

-- Only one execution may hold processing authority for a conversation.
CREATE UNIQUE INDEX "processing_runs_one_active_per_conversation"
  ON "processing_runs"("conversation_id")
  WHERE "status" IN ('ACCEPTED', 'RUNNING');

-- Ledger and reservation quantities are magnitudes; the entry kind supplies direction.
ALTER TABLE "credit_reservations"
  ADD CONSTRAINT "credit_reservations_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "credit_entries"
  ADD CONSTRAINT "credit_entries_quantity_positive" CHECK ("quantity" > 0);

CREATE UNIQUE INDEX "credit_entries_one_settlement_per_reservation"
  ON "credit_entries"("reservation_id")
  WHERE "kind" IN ('CONSUME', 'RESTORE');

ALTER TABLE "transcript_evidence"
  ADD CONSTRAINT "transcript_evidence_offsets_valid"
  CHECK ("start_offset" >= 0 AND "end_offset" > "start_offset"),
  ADD CONSTRAINT "transcript_evidence_times_valid"
  CHECK (
    ("start_ms" IS NULL AND "end_ms" IS NULL)
    OR (
      "start_ms" IS NOT NULL
      AND "end_ms" IS NOT NULL
      AND "start_ms" >= 0
      AND "end_ms" > "start_ms"
    )
  );

ALTER TABLE "speaker_segments"
  ADD CONSTRAINT "speaker_segments_times_valid"
  CHECK ("start_ms" >= 0 AND "end_ms" > "start_ms"),
  ADD CONSTRAINT "speaker_segments_confidence_valid"
  CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));

-- Provider transcripts are evidence. Their contents and provenance cannot be rewritten.
CREATE OR REPLACE FUNCTION prevent_original_transcript_update()
RETURNS trigger AS $$
BEGIN
  IF NEW."workspace_id" IS DISTINCT FROM OLD."workspace_id"
     OR NEW."conversation_id" IS DISTINCT FROM OLD."conversation_id"
     OR NEW."processing_run_id" IS DISTINCT FROM OLD."processing_run_id"
     OR NEW."text" IS DISTINCT FROM OLD."text"
     OR NEW."language" IS DISTINCT FROM OLD."language"
     OR NEW."finalized_at" IS DISTINCT FROM OLD."finalized_at"
     OR NEW."content_fingerprint" IS DISTINCT FROM OLD."content_fingerprint"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'original transcript fields are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "original_transcripts_immutable"
BEFORE UPDATE ON "original_transcripts"
FOR EACH ROW EXECUTE FUNCTION prevent_original_transcript_update();
