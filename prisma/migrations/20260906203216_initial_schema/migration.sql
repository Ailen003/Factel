-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('TRIAL_USER', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETING', 'DELETED');

-- CreateEnum
CREATE TYPE "AppLocale" AS ENUM ('EN', 'ES');

-- CreateEnum
CREATE TYPE "WorkspaceLifecycle" AS ENUM ('ACTIVE', 'DELETING', 'DELETED');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('INSTALLATION', 'REPAIR', 'MAINTENANCE', 'INSPECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConversationSourceType" AS ENUM ('MICROPHONE', 'UPLOAD');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('DRAFT', 'AUDIO_READY', 'QUEUED', 'TRANSCRIBING', 'DIARIZING', 'EXTRACTING', 'VALIDATING', 'NEEDS_REVIEW', 'READY', 'RECORD_PLAN_PENDING', 'COMPLETED', 'FAILED', 'QUOTA_BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeletionState" AS ENUM ('ACTIVE', 'DELETE_REQUESTED', 'DELETING', 'DELETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ArtifactVerificationState" AS ENUM ('PENDING', 'UPLOADED', 'VERIFIED', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "UploadGrantStatus" AS ENUM ('ISSUED', 'COMPLETED', 'CONSUMED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DiarizationStatus" AS ENUM ('PENDING', 'AVAILABLE', 'UNAVAILABLE', 'FAILED');

-- CreateEnum
CREATE TYPE "ProposalAuthorKind" AS ENUM ('EXTRACTION', 'HUMAN');

-- CreateEnum
CREATE TYPE "ProposalRevisionStatus" AS ENUM ('CANDIDATE', 'READY', 'SUPERSEDED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "ProposalFieldTarget" AS ENUM ('CLIENT', 'REQUEST');

-- CreateEnum
CREATE TYPE "ProposalFieldProvenance" AS ENUM ('EXTRACTED', 'MANUAL', 'DEFAULT');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('BLOCKING', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "FindingCode" AS ENUM ('MISSING_REQUIRED', 'INVALID_FORMAT', 'NONEXISTENT_EVIDENCE', 'AMBIGUITY', 'CONTRADICTION', 'LOW_CONFIDENCE', 'SENSITIVE_DATA_OMITTED');

-- CreateEnum
CREATE TYPE "ProcessingRunStatus" AS ENUM ('ACCEPTED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'QUOTA_BLOCKED');

-- CreateEnum
CREATE TYPE "ProcessingStage" AS ENUM ('QUEUED', 'TRANSCRIBING', 'DIARIZING', 'EXTRACTING', 'VALIDATING', 'PUBLISHING');

-- CreateEnum
CREATE TYPE "CheckpointOutcome" AS ENUM ('PENDING', 'SUCCEEDED', 'RETRYABLE_FAILURE', 'TERMINAL_FAILURE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ProviderInvocationStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'RATE_LIMITED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreditEntryKind" AS ENUM ('GRANT', 'RESERVE', 'CONSUME', 'RESTORE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CreditReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RESTORED');

-- CreateEnum
CREATE TYPE "RecordPlanKind" AS ENUM ('MANUAL_CLIENT_CREATE', 'MANUAL_REQUEST_CREATE', 'CONVERSATION_BATCH_CREATE');

-- CreateEnum
CREATE TYPE "RecordPlanStatus" AS ENUM ('PREPARED', 'APPROVED', 'DENIED', 'COMMITTED', 'INVALIDATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RecordApprovalDecision" AS ENUM ('APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "RecordOrigin" AS ENUM ('MANUAL', 'CONVERSATION');

-- CreateEnum
CREATE TYPE "OperationOutcome" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssistantMessageRole" AS ENUM ('USER', 'ASSISTANT', 'TOOL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AssistantMessageStatus" AS ENUM ('PENDING', 'STREAMING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ToolInvocationStatus" AS ENUM ('PENDING', 'AWAITING_APPROVAL', 'SUCCEEDED', 'DENIED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('ALLOWED', 'DENIED', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CleanupTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CircuitState" AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "name" VARCHAR(201) NOT NULL,
    "image" TEXT,
    "role" "AppRole" NOT NULL DEFAULT 'TRIAL_USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" "AppLocale" NOT NULL DEFAULT 'EN',
    "temporary_password_change_required" BOOLEAN NOT NULL DEFAULT false,
    "initial_credit_allocation" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "lifecycle" "WorkspaceLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" VARCHAR(320),
    "normalized_email" VARCHAR(320),
    "phone" VARCHAR(64),
    "normalized_phone" VARCHAR(64),
    "company" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "creation_operation_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "updated_by_user_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "priority" "RequestPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "preferred_schedule" TEXT,
    "service_address" TEXT,
    "next_steps" TEXT,
    "creation_operation_id" TEXT NOT NULL,
    "source_proposal_item_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "updated_by_user_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "source_type" "ConversationSourceType" NOT NULL,
    "locale" "AppLocale" NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'DRAFT',
    "current_run_id" TEXT,
    "current_proposal_revision_id" TEXT,
    "completed_operation_id" TEXT,
    "correlation_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletion_state" "DeletionState" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_artifacts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_filename" TEXT,
    "verified_mime_type" VARCHAR(127),
    "verified_container" VARCHAR(64),
    "byte_size" BIGINT,
    "duration_ms" INTEGER,
    "checksum_algorithm" VARCHAR(32),
    "checksum" VARCHAR(256),
    "verification_state" "ArtifactVerificationState" NOT NULL DEFAULT 'PENDING',
    "deletion_state" "DeletionState" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_grants" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "expected_artifact_id" TEXT NOT NULL,
    "permitted_mime_types" JSONB NOT NULL,
    "maximum_bytes" BIGINT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "UploadGrantStatus" NOT NULL DEFAULT 'ISSUED',
    "completed_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_runs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "previous_run_id" TEXT,
    "status" "ProcessingRunStatus" NOT NULL DEFAULT 'ACCEPTED',
    "stage" "ProcessingStage" NOT NULL DEFAULT 'QUEUED',
    "task_profile_version" TEXT,
    "policy_version" TEXT,
    "correlation_id" TEXT NOT NULL,
    "terminal_reason" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_checkpoints" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "stage" "ProcessingStage" NOT NULL,
    "attempt" INTEGER NOT NULL,
    "lease_reference" TEXT,
    "outcome" "CheckpointOutcome" NOT NULL DEFAULT 'PENDING',
    "committed_artifact_ids" JSONB,
    "safe_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "original_transcripts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "processing_run_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "language" "AppLocale" NOT NULL,
    "finalized_at" TIMESTAMP(3) NOT NULL,
    "content_fingerprint" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "original_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_evidence" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "transcript_id" TEXT NOT NULL,
    "stable_evidence_id" TEXT NOT NULL,
    "start_offset" INTEGER NOT NULL,
    "end_offset" INTEGER NOT NULL,
    "start_ms" INTEGER,
    "end_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcript_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diarization_versions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "processing_run_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "DiarizationStatus" NOT NULL DEFAULT 'PENDING',
    "warnings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diarization_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaker_segments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "diarization_version_id" TEXT NOT NULL,
    "evidence_id" TEXT,
    "start_ms" INTEGER NOT NULL,
    "end_ms" INTEGER NOT NULL,
    "speaker_label" VARCHAR(128),
    "confidence" DECIMAL(5,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaker_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_revisions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "parent_revision_id" TEXT,
    "producing_run_id" TEXT,
    "transcript_id" TEXT,
    "diarization_version_id" TEXT,
    "schema_version" TEXT NOT NULL,
    "task_profile_version" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "policy_version" TEXT NOT NULL,
    "author_kind" "ProposalAuthorKind" NOT NULL,
    "author_user_id" TEXT,
    "validation_summary" JSONB,
    "status" "ProposalRevisionStatus" NOT NULL DEFAULT 'CANDIDATE',
    "ready_at" TIMESTAMP(3),
    "ready_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_client_drafts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "stable_item_id" TEXT NOT NULL,
    "name" TEXT,
    "email" VARCHAR(320),
    "normalized_email" VARCHAR(320),
    "phone" VARCHAR(64),
    "normalized_phone" VARCHAR(64),
    "company" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_client_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_request_items" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "stable_item_id" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "service_type" "ServiceType",
    "priority" "RequestPriority",
    "preferred_schedule" TEXT,
    "service_address" TEXT,
    "next_steps" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_fields" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "target" "ProposalFieldTarget" NOT NULL,
    "request_item_id" TEXT,
    "field_key" VARCHAR(128) NOT NULL,
    "observed_value" TEXT,
    "normalized_value" TEXT,
    "provenance" "ProposalFieldProvenance" NOT NULL,
    "confidence" DECIMAL(5,4),
    "validation_findings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_field_evidence" (
    "proposal_field_id" TEXT NOT NULL,
    "evidence_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_field_evidence_pkey" PRIMARY KEY ("proposal_field_id","evidence_id","workspace_id")
);

-- CreateTable
CREATE TABLE "proposal_findings" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "field_id" TEXT,
    "code" "FindingCode" NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "safe_message" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_reservations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "processing_run_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "CreditReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),
    "settlement_reason" TEXT,
    "operation_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_entries" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "kind" "CreditEntryKind" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reservation_id" TEXT,
    "processing_run_id" TEXT,
    "actor_user_id" TEXT,
    "reason" TEXT,
    "operation_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_invocations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "processing_run_id" TEXT,
    "assistant_message_id" TEXT,
    "capability" VARCHAR(128) NOT NULL,
    "provider_alias" VARCHAR(128) NOT NULL,
    "model_alias" VARCHAR(128),
    "task_profile_version" TEXT,
    "prompt_fingerprint" VARCHAR(128),
    "schema_fingerprint" VARCHAR(128),
    "latency_ms" INTEGER,
    "usage" JSONB,
    "status" "ProviderInvocationStatus" NOT NULL DEFAULT 'PENDING',
    "safe_error" TEXT,
    "correlation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_invocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_plans" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "kind" "RecordPlanKind" NOT NULL,
    "status" "RecordPlanStatus" NOT NULL DEFAULT 'PREPARED',
    "normalized_payload" JSONB,
    "payload_purged_at" TIMESTAMP(3),
    "selected_client_id" TEXT,
    "selected_client_version" INTEGER,
    "duplicate_candidates" JSONB,
    "duplicate_decision" TEXT,
    "source_conversation_id" TEXT,
    "source_revision_id" TEXT,
    "plan_version" INTEGER NOT NULL DEFAULT 1,
    "plan_hash" VARCHAR(128) NOT NULL,
    "operation_intent" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "invalidated_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "record_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_approvals" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "plan_hash" VARCHAR(128) NOT NULL,
    "user_id" TEXT NOT NULL,
    "decision" "RecordApprovalDecision" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_receipts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "operation_intent" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "origin" "RecordOrigin" NOT NULL,
    "outcome" "OperationOutcome" NOT NULL DEFAULT 'PENDING',
    "source_conversation_id" TEXT,
    "source_revision_id" TEXT,
    "source_deleted" BOOLEAN NOT NULL DEFAULT false,
    "selected_client_id" TEXT,
    "result_request_ids" JSONB,
    "actor_user_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "operation_id" TEXT,
    "event_type" VARCHAR(128) NOT NULL,
    "aggregate_type" VARCHAR(128) NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload" JSONB,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correlation_id" TEXT NOT NULL,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "safe_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_threads" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_messages" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "author_user_id" TEXT,
    "role" "AssistantMessageRole" NOT NULL,
    "content" TEXT,
    "status" "AssistantMessageStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_resource_references" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "resource_type" VARCHAR(128) NOT NULL,
    "resource_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_resource_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_invocations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "tool_code" VARCHAR(128) NOT NULL,
    "arguments" JSONB,
    "result" JSONB,
    "status" "ToolInvocationStatus" NOT NULL DEFAULT 'PENDING',
    "record_plan_id" TEXT,
    "record_approval_id" TEXT,
    "operation_receipt_id" TEXT,
    "correlation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_invocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "actor_user_id" TEXT,
    "target_user_id" TEXT,
    "resource_type" VARCHAR(128) NOT NULL,
    "resource_id" TEXT,
    "action" VARCHAR(128) NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "declared_reason" TEXT,
    "correlation_id" TEXT NOT NULL,
    "safe_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleanup_tasks" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "resource_type" VARCHAR(128) NOT NULL,
    "resource_id" TEXT NOT NULL,
    "storage_key" TEXT,
    "deletion_intent" VARCHAR(128) NOT NULL,
    "status" "CleanupTaskStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requested_by_user_id" TEXT,
    "correlation_id" TEXT NOT NULL,
    "safe_error" TEXT,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cleanup_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_profiles" (
    "id" TEXT NOT NULL,
    "capability" VARCHAR(128) NOT NULL,
    "version" VARCHAR(128) NOT NULL,
    "provider_alias" VARCHAR(128) NOT NULL,
    "model_alias" VARCHAR(128),
    "schema_version" TEXT,
    "prompt_version" TEXT,
    "policy_version" TEXT,
    "runtime_limits" JSONB NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_policies" (
    "id" TEXT NOT NULL,
    "policy_key" VARCHAR(128) NOT NULL,
    "version" VARCHAR(128) NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "feature_enabled" BOOLEAN NOT NULL DEFAULT true,
    "circuit_state" "CircuitState" NOT NULL DEFAULT 'CLOSED',
    "runtime_limits" JSONB,
    "configuration" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "account_user_id_idx" ON "account"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_provider_id_account_id_key" ON "account"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_owner_id_key" ON "workspaces"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_id_owner_id_key" ON "workspaces"("id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_creation_operation_id_key" ON "clients"("creation_operation_id");

-- CreateIndex
CREATE INDEX "clients_workspace_id_normalized_email_idx" ON "clients"("workspace_id", "normalized_email");

-- CreateIndex
CREATE INDEX "clients_workspace_id_normalized_phone_idx" ON "clients"("workspace_id", "normalized_phone");

-- CreateIndex
CREATE INDEX "clients_workspace_id_created_at_idx" ON "clients"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "clients_id_workspace_id_key" ON "clients"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_creation_operation_id_workspace_id_key" ON "clients"("creation_operation_id", "workspace_id");

-- CreateIndex
CREATE INDEX "service_requests_workspace_id_client_id_created_at_idx" ON "service_requests"("workspace_id", "client_id", "created_at");

-- CreateIndex
CREATE INDEX "service_requests_workspace_id_status_idx" ON "service_requests"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "service_requests_workspace_id_source_proposal_item_id_idx" ON "service_requests"("workspace_id", "source_proposal_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_id_workspace_id_key" ON "service_requests"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_current_run_id_key" ON "conversations"("current_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_current_proposal_revision_id_key" ON "conversations"("current_proposal_revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_completed_operation_id_key" ON "conversations"("completed_operation_id");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_status_created_at_idx" ON "conversations"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_deletion_state_idx" ON "conversations"("workspace_id", "deletion_state");

-- CreateIndex
CREATE INDEX "conversations_correlation_id_idx" ON "conversations"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_id_workspace_id_key" ON "conversations"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_current_run_id_workspace_id_key" ON "conversations"("current_run_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_current_proposal_revision_id_workspace_id_key" ON "conversations"("current_proposal_revision_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_completed_operation_id_workspace_id_key" ON "conversations"("completed_operation_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "audio_artifacts_conversation_id_key" ON "audio_artifacts"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "audio_artifacts_storage_key_key" ON "audio_artifacts"("storage_key");

-- CreateIndex
CREATE INDEX "audio_artifacts_workspace_id_verification_state_idx" ON "audio_artifacts"("workspace_id", "verification_state");

-- CreateIndex
CREATE INDEX "audio_artifacts_workspace_id_deletion_state_idx" ON "audio_artifacts"("workspace_id", "deletion_state");

-- CreateIndex
CREATE UNIQUE INDEX "audio_artifacts_conversation_id_workspace_id_key" ON "audio_artifacts"("conversation_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "upload_grants_expected_artifact_id_key" ON "upload_grants"("expected_artifact_id");

-- CreateIndex
CREATE UNIQUE INDEX "upload_grants_idempotency_key_key" ON "upload_grants"("idempotency_key");

-- CreateIndex
CREATE INDEX "upload_grants_workspace_id_conversation_id_expires_at_idx" ON "upload_grants"("workspace_id", "conversation_id", "expires_at");

-- CreateIndex
CREATE INDEX "upload_grants_status_expires_at_idx" ON "upload_grants"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "processing_runs_idempotency_key_key" ON "processing_runs"("idempotency_key");

-- CreateIndex
CREATE INDEX "processing_runs_workspace_id_conversation_id_created_at_idx" ON "processing_runs"("workspace_id", "conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "processing_runs_workspace_id_status_stage_idx" ON "processing_runs"("workspace_id", "status", "stage");

-- CreateIndex
CREATE INDEX "processing_runs_correlation_id_idx" ON "processing_runs"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "processing_runs_id_workspace_id_key" ON "processing_runs"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "processing_checkpoints_workspace_id_run_id_stage_idx" ON "processing_checkpoints"("workspace_id", "run_id", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "processing_checkpoints_run_id_stage_attempt_key" ON "processing_checkpoints"("run_id", "stage", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "original_transcripts_conversation_id_key" ON "original_transcripts"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "original_transcripts_processing_run_id_key" ON "original_transcripts"("processing_run_id");

-- CreateIndex
CREATE INDEX "original_transcripts_workspace_id_conversation_id_idx" ON "original_transcripts"("workspace_id", "conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "original_transcripts_id_workspace_id_key" ON "original_transcripts"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "original_transcripts_conversation_id_workspace_id_key" ON "original_transcripts"("conversation_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "original_transcripts_processing_run_id_workspace_id_key" ON "original_transcripts"("processing_run_id", "workspace_id");

-- CreateIndex
CREATE INDEX "transcript_evidence_workspace_id_transcript_id_start_offset_idx" ON "transcript_evidence"("workspace_id", "transcript_id", "start_offset");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_evidence_transcript_id_stable_evidence_id_key" ON "transcript_evidence"("transcript_id", "stable_evidence_id");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_evidence_id_workspace_id_key" ON "transcript_evidence"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "diarization_versions_workspace_id_conversation_id_status_idx" ON "diarization_versions"("workspace_id", "conversation_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "diarization_versions_id_workspace_id_key" ON "diarization_versions"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "diarization_versions_conversation_id_version_key" ON "diarization_versions"("conversation_id", "version");

-- CreateIndex
CREATE INDEX "speaker_segments_workspace_id_diarization_version_id_start__idx" ON "speaker_segments"("workspace_id", "diarization_version_id", "start_ms");

-- CreateIndex
CREATE INDEX "proposal_revisions_workspace_id_conversation_id_status_idx" ON "proposal_revisions"("workspace_id", "conversation_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_revisions_id_workspace_id_key" ON "proposal_revisions"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_revisions_conversation_id_revision_number_key" ON "proposal_revisions"("conversation_id", "revision_number");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_client_drafts_revision_id_key" ON "proposal_client_drafts"("revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_client_drafts_revision_id_stable_item_id_key" ON "proposal_client_drafts"("revision_id", "stable_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_client_drafts_revision_id_workspace_id_key" ON "proposal_client_drafts"("revision_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_request_items_id_workspace_id_key" ON "proposal_request_items"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_request_items_revision_id_stable_item_id_key" ON "proposal_request_items"("revision_id", "stable_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_request_items_revision_id_display_order_key" ON "proposal_request_items"("revision_id", "display_order");

-- CreateIndex
CREATE INDEX "proposal_fields_workspace_id_revision_id_idx" ON "proposal_fields"("workspace_id", "revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_fields_revision_id_target_request_item_id_field_ke_key" ON "proposal_fields"("revision_id", "target", "request_item_id", "field_key");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_fields_id_workspace_id_key" ON "proposal_fields"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "proposal_findings_workspace_id_revision_id_severity_idx" ON "proposal_findings"("workspace_id", "revision_id", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "credit_reservations_processing_run_id_key" ON "credit_reservations"("processing_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_reservations_operation_key_key" ON "credit_reservations"("operation_key");

-- CreateIndex
CREATE INDEX "credit_reservations_workspace_id_status_idx" ON "credit_reservations"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "credit_reservations_id_workspace_id_key" ON "credit_reservations"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_reservations_processing_run_id_workspace_id_key" ON "credit_reservations"("processing_run_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_entries_operation_key_key" ON "credit_entries"("operation_key");

-- CreateIndex
CREATE INDEX "credit_entries_workspace_id_created_at_idx" ON "credit_entries"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "credit_entries_workspace_id_kind_idx" ON "credit_entries"("workspace_id", "kind");

-- CreateIndex
CREATE INDEX "provider_invocations_workspace_id_capability_created_at_idx" ON "provider_invocations"("workspace_id", "capability", "created_at");

-- CreateIndex
CREATE INDEX "provider_invocations_correlation_id_idx" ON "provider_invocations"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "record_plans_plan_hash_key" ON "record_plans"("plan_hash");

-- CreateIndex
CREATE UNIQUE INDEX "record_plans_operation_intent_key" ON "record_plans"("operation_intent");

-- CreateIndex
CREATE INDEX "record_plans_workspace_id_status_expires_at_idx" ON "record_plans"("workspace_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "record_plans_workspace_id_source_conversation_id_idx" ON "record_plans"("workspace_id", "source_conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "record_plans_id_workspace_id_key" ON "record_plans"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "record_approvals_workspace_id_plan_id_expires_at_idx" ON "record_approvals"("workspace_id", "plan_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "record_approvals_plan_id_plan_hash_user_id_key" ON "record_approvals"("plan_id", "plan_hash", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "record_approvals_id_workspace_id_key" ON "record_approvals"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "operation_receipts_plan_id_key" ON "operation_receipts"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "operation_receipts_operation_intent_key" ON "operation_receipts"("operation_intent");

-- CreateIndex
CREATE UNIQUE INDEX "operation_receipts_idempotency_key_key" ON "operation_receipts"("idempotency_key");

-- CreateIndex
CREATE INDEX "operation_receipts_workspace_id_outcome_created_at_idx" ON "operation_receipts"("workspace_id", "outcome", "created_at");

-- CreateIndex
CREATE INDEX "operation_receipts_workspace_id_source_conversation_id_idx" ON "operation_receipts"("workspace_id", "source_conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "operation_receipts_id_workspace_id_key" ON "operation_receipts"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "operation_receipts_plan_id_workspace_id_key" ON "operation_receipts"("plan_id", "workspace_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_workspace_id_aggregate_type_aggregate_id_idx" ON "outbox_events"("workspace_id", "aggregate_type", "aggregate_id");

-- CreateIndex
CREATE INDEX "outbox_events_correlation_id_idx" ON "outbox_events"("correlation_id");

-- CreateIndex
CREATE INDEX "assistant_threads_workspace_id_owner_user_id_updated_at_idx" ON "assistant_threads"("workspace_id", "owner_user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "assistant_threads_id_workspace_id_key" ON "assistant_threads"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "assistant_messages_workspace_id_thread_id_created_at_idx" ON "assistant_messages"("workspace_id", "thread_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "assistant_messages_id_workspace_id_key" ON "assistant_messages"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "assistant_resource_references_workspace_id_conversation_id_idx" ON "assistant_resource_references"("workspace_id", "conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "assistant_resource_references_thread_id_resource_type_resou_key" ON "assistant_resource_references"("thread_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "tool_invocations_workspace_id_thread_id_created_at_idx" ON "tool_invocations"("workspace_id", "thread_id", "created_at");

-- CreateIndex
CREATE INDEX "tool_invocations_correlation_id_idx" ON "tool_invocations"("correlation_id");

-- CreateIndex
CREATE INDEX "audit_events_workspace_id_created_at_idx" ON "audit_events"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_created_at_idx" ON "audit_events"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_correlation_id_idx" ON "audit_events"("correlation_id");

-- CreateIndex
CREATE INDEX "cleanup_tasks_status_available_at_idx" ON "cleanup_tasks"("status", "available_at");

-- CreateIndex
CREATE INDEX "cleanup_tasks_workspace_id_created_at_idx" ON "cleanup_tasks"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "cleanup_tasks_correlation_id_idx" ON "cleanup_tasks"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "cleanup_tasks_resource_type_resource_id_deletion_intent_key" ON "cleanup_tasks"("resource_type", "resource_id", "deletion_intent");

-- CreateIndex
CREATE INDEX "task_profiles_capability_status_idx" ON "task_profiles"("capability", "status");

-- CreateIndex
CREATE UNIQUE INDEX "task_profiles_capability_version_key" ON "task_profiles"("capability", "version");

-- CreateIndex
CREATE UNIQUE INDEX "platform_policies_policy_key_key" ON "platform_policies"("policy_key");

-- CreateIndex
CREATE INDEX "platform_policies_status_feature_enabled_idx" ON "platform_policies"("status", "feature_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "platform_policies_policy_key_version_key" ON "platform_policies"("policy_key", "version");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_creation_operation_id_workspace_id_fkey" FOREIGN KEY ("creation_operation_id", "workspace_id") REFERENCES "operation_receipts"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_client_id_workspace_id_fkey" FOREIGN KEY ("client_id", "workspace_id") REFERENCES "clients"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_creation_operation_id_workspace_id_fkey" FOREIGN KEY ("creation_operation_id", "workspace_id") REFERENCES "operation_receipts"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_current_run_id_workspace_id_fkey" FOREIGN KEY ("current_run_id", "workspace_id") REFERENCES "processing_runs"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_current_proposal_revision_id_workspace_id_fkey" FOREIGN KEY ("current_proposal_revision_id", "workspace_id") REFERENCES "proposal_revisions"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_completed_operation_id_workspace_id_fkey" FOREIGN KEY ("completed_operation_id", "workspace_id") REFERENCES "operation_receipts"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_artifacts" ADD CONSTRAINT "audio_artifacts_conversation_id_workspace_id_fkey" FOREIGN KEY ("conversation_id", "workspace_id") REFERENCES "conversations"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_grants" ADD CONSTRAINT "upload_grants_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_grants" ADD CONSTRAINT "upload_grants_conversation_id_workspace_id_fkey" FOREIGN KEY ("conversation_id", "workspace_id") REFERENCES "conversations"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_runs" ADD CONSTRAINT "processing_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_runs" ADD CONSTRAINT "processing_runs_conversation_id_workspace_id_fkey" FOREIGN KEY ("conversation_id", "workspace_id") REFERENCES "conversations"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_runs" ADD CONSTRAINT "processing_runs_previous_run_id_workspace_id_fkey" FOREIGN KEY ("previous_run_id", "workspace_id") REFERENCES "processing_runs"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_checkpoints" ADD CONSTRAINT "processing_checkpoints_run_id_workspace_id_fkey" FOREIGN KEY ("run_id", "workspace_id") REFERENCES "processing_runs"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "original_transcripts" ADD CONSTRAINT "original_transcripts_conversation_id_workspace_id_fkey" FOREIGN KEY ("conversation_id", "workspace_id") REFERENCES "conversations"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "original_transcripts" ADD CONSTRAINT "original_transcripts_processing_run_id_workspace_id_fkey" FOREIGN KEY ("processing_run_id", "workspace_id") REFERENCES "processing_runs"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_evidence" ADD CONSTRAINT "transcript_evidence_transcript_id_workspace_id_fkey" FOREIGN KEY ("transcript_id", "workspace_id") REFERENCES "original_transcripts"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diarization_versions" ADD CONSTRAINT "diarization_versions_conversation_id_workspace_id_fkey" FOREIGN KEY ("conversation_id", "workspace_id") REFERENCES "conversations"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diarization_versions" ADD CONSTRAINT "diarization_versions_processing_run_id_workspace_id_fkey" FOREIGN KEY ("processing_run_id", "workspace_id") REFERENCES "processing_runs"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaker_segments" ADD CONSTRAINT "speaker_segments_diarization_version_id_workspace_id_fkey" FOREIGN KEY ("diarization_version_id", "workspace_id") REFERENCES "diarization_versions"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaker_segments" ADD CONSTRAINT "speaker_segments_evidence_id_workspace_id_fkey" FOREIGN KEY ("evidence_id", "workspace_id") REFERENCES "transcript_evidence"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_revisions" ADD CONSTRAINT "proposal_revisions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_revisions" ADD CONSTRAINT "proposal_revisions_conversation_id_workspace_id_fkey" FOREIGN KEY ("conversation_id", "workspace_id") REFERENCES "conversations"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_revisions" ADD CONSTRAINT "proposal_revisions_parent_revision_id_workspace_id_fkey" FOREIGN KEY ("parent_revision_id", "workspace_id") REFERENCES "proposal_revisions"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_revisions" ADD CONSTRAINT "proposal_revisions_producing_run_id_workspace_id_fkey" FOREIGN KEY ("producing_run_id", "workspace_id") REFERENCES "processing_runs"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_revisions" ADD CONSTRAINT "proposal_revisions_transcript_id_workspace_id_fkey" FOREIGN KEY ("transcript_id", "workspace_id") REFERENCES "original_transcripts"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_revisions" ADD CONSTRAINT "proposal_revisions_diarization_version_id_workspace_id_fkey" FOREIGN KEY ("diarization_version_id", "workspace_id") REFERENCES "diarization_versions"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_revisions" ADD CONSTRAINT "proposal_revisions_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_revisions" ADD CONSTRAINT "proposal_revisions_ready_by_user_id_fkey" FOREIGN KEY ("ready_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_client_drafts" ADD CONSTRAINT "proposal_client_drafts_revision_id_workspace_id_fkey" FOREIGN KEY ("revision_id", "workspace_id") REFERENCES "proposal_revisions"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_request_items" ADD CONSTRAINT "proposal_request_items_revision_id_workspace_id_fkey" FOREIGN KEY ("revision_id", "workspace_id") REFERENCES "proposal_revisions"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_fields" ADD CONSTRAINT "proposal_fields_revision_id_workspace_id_fkey" FOREIGN KEY ("revision_id", "workspace_id") REFERENCES "proposal_revisions"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_fields" ADD CONSTRAINT "proposal_fields_request_item_id_workspace_id_fkey" FOREIGN KEY ("request_item_id", "workspace_id") REFERENCES "proposal_request_items"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_field_evidence" ADD CONSTRAINT "proposal_field_evidence_proposal_field_id_workspace_id_fkey" FOREIGN KEY ("proposal_field_id", "workspace_id") REFERENCES "proposal_fields"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_field_evidence" ADD CONSTRAINT "proposal_field_evidence_evidence_id_workspace_id_fkey" FOREIGN KEY ("evidence_id", "workspace_id") REFERENCES "transcript_evidence"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_findings" ADD CONSTRAINT "proposal_findings_revision_id_workspace_id_fkey" FOREIGN KEY ("revision_id", "workspace_id") REFERENCES "proposal_revisions"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_findings" ADD CONSTRAINT "proposal_findings_field_id_workspace_id_fkey" FOREIGN KEY ("field_id", "workspace_id") REFERENCES "proposal_fields"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_processing_run_id_workspace_id_fkey" FOREIGN KEY ("processing_run_id", "workspace_id") REFERENCES "processing_runs"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_reservation_id_workspace_id_fkey" FOREIGN KEY ("reservation_id", "workspace_id") REFERENCES "credit_reservations"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_processing_run_id_workspace_id_fkey" FOREIGN KEY ("processing_run_id", "workspace_id") REFERENCES "processing_runs"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_invocations" ADD CONSTRAINT "provider_invocations_processing_run_id_workspace_id_fkey" FOREIGN KEY ("processing_run_id", "workspace_id") REFERENCES "processing_runs"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_invocations" ADD CONSTRAINT "provider_invocations_assistant_message_id_workspace_id_fkey" FOREIGN KEY ("assistant_message_id", "workspace_id") REFERENCES "assistant_messages"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_invocations" ADD CONSTRAINT "provider_invocations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_plans" ADD CONSTRAINT "record_plans_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_plans" ADD CONSTRAINT "record_plans_selected_client_id_workspace_id_fkey" FOREIGN KEY ("selected_client_id", "workspace_id") REFERENCES "clients"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_plans" ADD CONSTRAINT "record_plans_source_conversation_id_workspace_id_fkey" FOREIGN KEY ("source_conversation_id", "workspace_id") REFERENCES "conversations"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_plans" ADD CONSTRAINT "record_plans_source_revision_id_workspace_id_fkey" FOREIGN KEY ("source_revision_id", "workspace_id") REFERENCES "proposal_revisions"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_plans" ADD CONSTRAINT "record_plans_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_approvals" ADD CONSTRAINT "record_approvals_plan_id_workspace_id_fkey" FOREIGN KEY ("plan_id", "workspace_id") REFERENCES "record_plans"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_approvals" ADD CONSTRAINT "record_approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_receipts" ADD CONSTRAINT "operation_receipts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_receipts" ADD CONSTRAINT "operation_receipts_plan_id_workspace_id_fkey" FOREIGN KEY ("plan_id", "workspace_id") REFERENCES "record_plans"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_receipts" ADD CONSTRAINT "operation_receipts_source_conversation_id_workspace_id_fkey" FOREIGN KEY ("source_conversation_id", "workspace_id") REFERENCES "conversations"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_receipts" ADD CONSTRAINT "operation_receipts_source_revision_id_workspace_id_fkey" FOREIGN KEY ("source_revision_id", "workspace_id") REFERENCES "proposal_revisions"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_receipts" ADD CONSTRAINT "operation_receipts_selected_client_id_workspace_id_fkey" FOREIGN KEY ("selected_client_id", "workspace_id") REFERENCES "clients"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_receipts" ADD CONSTRAINT "operation_receipts_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_operation_id_workspace_id_fkey" FOREIGN KEY ("operation_id", "workspace_id") REFERENCES "operation_receipts"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_thread_id_workspace_id_fkey" FOREIGN KEY ("thread_id", "workspace_id") REFERENCES "assistant_threads"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_resource_references" ADD CONSTRAINT "assistant_resource_references_thread_id_workspace_id_fkey" FOREIGN KEY ("thread_id", "workspace_id") REFERENCES "assistant_threads"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_resource_references" ADD CONSTRAINT "assistant_resource_references_conversation_id_workspace_id_fkey" FOREIGN KEY ("conversation_id", "workspace_id") REFERENCES "conversations"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_thread_id_workspace_id_fkey" FOREIGN KEY ("thread_id", "workspace_id") REFERENCES "assistant_threads"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_message_id_workspace_id_fkey" FOREIGN KEY ("message_id", "workspace_id") REFERENCES "assistant_messages"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_record_plan_id_workspace_id_fkey" FOREIGN KEY ("record_plan_id", "workspace_id") REFERENCES "record_plans"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_record_approval_id_workspace_id_fkey" FOREIGN KEY ("record_approval_id", "workspace_id") REFERENCES "record_approvals"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_operation_receipt_id_workspace_id_fkey" FOREIGN KEY ("operation_receipt_id", "workspace_id") REFERENCES "operation_receipts"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleanup_tasks" ADD CONSTRAINT "cleanup_tasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleanup_tasks" ADD CONSTRAINT "cleanup_tasks_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
