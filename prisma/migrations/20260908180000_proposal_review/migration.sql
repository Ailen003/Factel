-- Additive publication and authored-operation markers. Existing content is sealed.
ALTER TABLE "proposal_revisions"
  ADD COLUMN "operation_key" TEXT,
  ADD COLUMN "input_fingerprint" VARCHAR(64),
  ADD COLUMN "sealed_at" TIMESTAMP(3);
UPDATE "proposal_revisions" SET "sealed_at" = "created_at";
CREATE UNIQUE INDEX "proposal_revisions_operation_key_key" ON "proposal_revisions"("operation_key");
CREATE UNIQUE INDEX "proposal_revisions_one_extraction_per_run"
  ON "proposal_revisions"("producing_run_id") WHERE "author_kind" = 'EXTRACTION';
-- NULL request_item_id cannot protect client fields with an ordinary unique index.
CREATE UNIQUE INDEX "proposal_fields_unique_client_field"
  ON "proposal_fields"("revision_id", "field_key") WHERE "target" = 'CLIENT';
ALTER TABLE "proposal_fields" ADD CONSTRAINT "proposal_field_target_valid" CHECK (
  ("target" = 'CLIENT' AND "request_item_id" IS NULL AND "field_key" IN ('name','email','phone','company','address','notes'))
  OR ("target" = 'REQUEST' AND "request_item_id" IS NOT NULL AND "field_key" IN ('title','description','serviceType','priority','preferredSchedule','serviceAddress','nextSteps'))
), ADD CONSTRAINT "proposal_field_confidence_valid" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);

CREATE FUNCTION protect_proposal_revision() RETURNS trigger AS $$
DECLARE deleting BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT c."deletion_state" <> 'ACTIVE' OR w."lifecycle" <> 'ACTIVE' INTO deleting
      FROM "conversations" c JOIN "workspaces" w ON w."id" = c."workspace_id" WHERE c."id" = OLD."conversation_id";
    IF OLD."sealed_at" IS NOT NULL AND NOT deleting THEN RAISE EXCEPTION 'published revision is immutable'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."sealed_at" IS NOT NULL AND
    (to_jsonb(NEW) - ARRAY['status','ready_at','ready_by_user_id']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['status','ready_at','ready_by_user_id']) THEN
    RAISE EXCEPTION 'published revision is immutable';
  END IF;
  IF NEW."transcript_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "original_transcripts" t
    WHERE t."id" = NEW."transcript_id" AND t."conversation_id" = NEW."conversation_id" AND t."workspace_id" = NEW."workspace_id") THEN
    RAISE EXCEPTION 'proposal transcript scope mismatch';
  END IF;
  IF NEW."parent_revision_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "proposal_revisions" p
    WHERE p."id" = NEW."parent_revision_id" AND p."conversation_id" = NEW."conversation_id" AND p."workspace_id" = NEW."workspace_id") THEN
    RAISE EXCEPTION 'proposal parent scope mismatch';
  END IF;
  IF NEW."producing_run_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "processing_runs" r
    WHERE r."id" = NEW."producing_run_id" AND r."conversation_id" = NEW."conversation_id" AND r."workspace_id" = NEW."workspace_id") THEN
    RAISE EXCEPTION 'proposal run scope mismatch';
  END IF;
  IF NEW."diarization_version_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "diarization_versions" d
    WHERE d."id" = NEW."diarization_version_id" AND d."conversation_id" = NEW."conversation_id" AND d."workspace_id" = NEW."workspace_id") THEN
    RAISE EXCEPTION 'proposal diarization scope mismatch';
  END IF;
  IF NEW."sealed_at" IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM "proposal_client_drafts" WHERE "revision_id" = NEW."id") OR
       NOT EXISTS (SELECT 1 FROM "proposal_request_items" WHERE "revision_id" = NEW."id") THEN
      RAISE EXCEPTION 'proposal requires a client and at least one request draft';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "proposal_revisions_protected" BEFORE INSERT OR UPDATE OR DELETE ON "proposal_revisions"
  FOR EACH ROW EXECUTE FUNCTION protect_proposal_revision();

CREATE FUNCTION protect_proposal_content() RETURNS trigger AS $$
DECLARE owning_revision_id TEXT; parent RECORD; previous_revision_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'proposal_field_evidence' THEN
    SELECT f."revision_id" INTO owning_revision_id FROM "proposal_fields" f
      WHERE f."id" = CASE WHEN TG_OP = 'DELETE' THEN OLD."proposal_field_id" ELSE NEW."proposal_field_id" END;
  ELSE
    owning_revision_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."revision_id" ELSE NEW."revision_id" END;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'proposal_field_evidence' THEN
      SELECT f."revision_id" INTO previous_revision_id FROM "proposal_fields" f WHERE f."id" = OLD."proposal_field_id";
    ELSE previous_revision_id := OLD."revision_id";
    END IF;
    IF previous_revision_id IS DISTINCT FROM owning_revision_id THEN RAISE EXCEPTION 'proposal content cannot move revisions'; END IF;
  END IF;
  SELECT p."sealed_at", p."transcript_id", c."deletion_state", w."lifecycle" INTO parent
    FROM "proposal_revisions" p JOIN "conversations" c ON c."id" = p."conversation_id"
    JOIN "workspaces" w ON w."id" = p."workspace_id" WHERE p."id" = owning_revision_id;
  IF parent."sealed_at" IS NOT NULL AND
    (TG_OP <> 'DELETE' OR (parent."deletion_state" = 'ACTIVE' AND parent."lifecycle" = 'ACTIVE')) THEN
    RAISE EXCEPTION 'published proposal content is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_TABLE_NAME = 'proposal_fields' THEN
    IF NEW."request_item_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "proposal_request_items" i
      WHERE i."id" = NEW."request_item_id" AND i."revision_id" = owning_revision_id) THEN RAISE EXCEPTION 'proposal item revision mismatch'; END IF;
  ELSIF TG_TABLE_NAME = 'proposal_field_evidence' THEN
    IF NOT EXISTS (SELECT 1 FROM "transcript_evidence" e WHERE e."id" = NEW."evidence_id" AND e."transcript_id" = parent."transcript_id") THEN
      RAISE EXCEPTION 'proposal evidence transcript mismatch';
    END IF;
    IF EXISTS (SELECT 1 FROM "proposal_fields" f WHERE f."id" = NEW."proposal_field_id" AND f."provenance" <> 'EXTRACTED') THEN
      RAISE EXCEPTION 'manual and default values cannot claim speech evidence';
    END IF;
  ELSIF TG_TABLE_NAME = 'proposal_findings' THEN
    IF NEW."field_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "proposal_fields" f WHERE f."id" = NEW."field_id" AND f."revision_id" = owning_revision_id) THEN
      RAISE EXCEPTION 'proposal finding revision mismatch';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "proposal_client_drafts_protected" BEFORE INSERT OR UPDATE OR DELETE ON "proposal_client_drafts" FOR EACH ROW EXECUTE FUNCTION protect_proposal_content();
CREATE TRIGGER "proposal_request_items_protected" BEFORE INSERT OR UPDATE OR DELETE ON "proposal_request_items" FOR EACH ROW EXECUTE FUNCTION protect_proposal_content();
CREATE TRIGGER "proposal_fields_protected" BEFORE INSERT OR UPDATE OR DELETE ON "proposal_fields" FOR EACH ROW EXECUTE FUNCTION protect_proposal_content();
CREATE TRIGGER "proposal_field_evidence_protected" BEFORE INSERT OR UPDATE OR DELETE ON "proposal_field_evidence" FOR EACH ROW EXECUTE FUNCTION protect_proposal_content();
CREATE TRIGGER "proposal_findings_protected" BEFORE INSERT OR UPDATE OR DELETE ON "proposal_findings" FOR EACH ROW EXECUTE FUNCTION protect_proposal_content();

CREATE FUNCTION check_current_proposal_scope() RETURNS trigger AS $$
BEGIN
  IF NEW."current_proposal_revision_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "proposal_revisions" p WHERE p."id" = NEW."current_proposal_revision_id"
    AND p."conversation_id" = NEW."id" AND p."workspace_id" = NEW."workspace_id" AND p."sealed_at" IS NOT NULL
  ) THEN RAISE EXCEPTION 'current proposal must be a sealed revision of this conversation'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "conversations_current_proposal_scope" BEFORE INSERT OR UPDATE OF "current_proposal_revision_id" ON "conversations"
  FOR EACH ROW EXECUTE FUNCTION check_current_proposal_scope();
