CREATE TYPE "TemporaryCredentialReason" AS ENUM (
  'EXPIRED_CREDENTIAL',
  'FORGOTTEN_PASSWORD',
  'SUSPECTED_COMPROMISE',
  'FAILURE_RECOVERY',
  'OTHER'
);

CREATE TYPE "TemporaryCredentialIssuanceStatus" AS ENUM (
  'PREPARED',
  'ISSUED',
  'SUPERSEDED',
  'FAILED'
);

CREATE TYPE "TemporaryCredentialDeliveryChannel" AS ENUM (
  'IN_PERSON',
  'PHONE',
  'SECURE_MESSAGE',
  'OTHER'
);

ALTER TABLE "users"
  ADD COLUMN "temporary_credential_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "temporary_credential_issuances" (
  "id" TEXT NOT NULL,
  "operation_id" UUID NOT NULL,
  "target_user_id" TEXT NOT NULL,
  "initiated_by_user_id" TEXT,
  "delivered_by_user_id" TEXT,
  "version" INTEGER NOT NULL,
  "purpose" "TemporaryPasswordPurpose" NOT NULL,
  "reason" "TemporaryCredentialReason" NOT NULL,
  "reason_note" VARCHAR(200),
  "status" "TemporaryCredentialIssuanceStatus" NOT NULL DEFAULT 'PREPARED',
  "prepared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issued_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "superseded_at" TIMESTAMP(3),
  "safe_failure_code" VARCHAR(64),
  "delivery_channel" "TemporaryCredentialDeliveryChannel",
  "delivered_at" TIMESTAMP(3),
  "superseded_by_id" TEXT,

  CONSTRAINT "temporary_credential_issuances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "temporary_credential_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "temporary_credential_reason_note_check" CHECK (
    (
      "reason" = 'OTHER'::"TemporaryCredentialReason"
      AND "reason_note" IS NOT NULL
      AND char_length(btrim("reason_note")) BETWEEN 1 AND 200
    )
    OR (
      "reason" <> 'OTHER'::"TemporaryCredentialReason"
      AND "reason_note" IS NULL
    )
  ),
  CONSTRAINT "temporary_credential_delivery_tuple_check" CHECK (
    (
      "delivery_channel" IS NULL
      AND "delivered_at" IS NULL
      AND "delivered_by_user_id" IS NULL
    )
    OR (
      "delivery_channel" IS NOT NULL
      AND "delivered_at" IS NOT NULL
      AND "delivered_by_user_id" IS NOT NULL
      AND "issued_at" IS NOT NULL
    )
  ),
  CONSTRAINT "temporary_credential_issued_expiry_check" CHECK (
    ("issued_at" IS NULL AND "expires_at" IS NULL)
    OR (
      "issued_at" IS NOT NULL
      AND "expires_at" IS NOT NULL
      AND "expires_at" > "issued_at"
    )
  ),
  CONSTRAINT "temporary_credential_lifecycle_check" CHECK (
    (
      "status" = 'PREPARED'::"TemporaryCredentialIssuanceStatus"
      AND "issued_at" IS NULL
      AND "expires_at" IS NULL
      AND "failed_at" IS NULL
      AND "superseded_at" IS NULL
      AND "safe_failure_code" IS NULL
      AND "delivery_channel" IS NULL
      AND "delivered_at" IS NULL
      AND "delivered_by_user_id" IS NULL
    )
    OR (
      "status" = 'ISSUED'::"TemporaryCredentialIssuanceStatus"
      AND "issued_at" IS NOT NULL
      AND "expires_at" IS NOT NULL
      AND "failed_at" IS NULL
      AND "superseded_at" IS NULL
      AND "safe_failure_code" IS NULL
    )
    OR (
      "status" = 'FAILED'::"TemporaryCredentialIssuanceStatus"
      AND "issued_at" IS NULL
      AND "expires_at" IS NULL
      AND "failed_at" IS NOT NULL
      AND "superseded_at" IS NULL
      AND "safe_failure_code" IS NOT NULL
      AND "delivery_channel" IS NULL
      AND "delivered_at" IS NULL
      AND "delivered_by_user_id" IS NULL
    )
    OR (
      "status" = 'SUPERSEDED'::"TemporaryCredentialIssuanceStatus"
      AND "failed_at" IS NULL
      AND "superseded_at" IS NOT NULL
      AND "safe_failure_code" IS NULL
    )
  )
);

CREATE UNIQUE INDEX "temporary_credential_issuances_operation_id_key"
  ON "temporary_credential_issuances"("operation_id");
CREATE UNIQUE INDEX "temporary_credential_issuances_target_user_id_version_key"
  ON "temporary_credential_issuances"("target_user_id", "version");
CREATE UNIQUE INDEX "temporary_credential_issuances_superseded_by_id_key"
  ON "temporary_credential_issuances"("superseded_by_id");
CREATE UNIQUE INDEX "temporary_credential_one_current_per_target_idx"
  ON "temporary_credential_issuances"("target_user_id")
  WHERE "status" IN (
    'PREPARED'::"TemporaryCredentialIssuanceStatus",
    'ISSUED'::"TemporaryCredentialIssuanceStatus"
  );
CREATE INDEX "temporary_credential_issuances_target_user_id_status_version_idx"
  ON "temporary_credential_issuances"("target_user_id", "status", "version");
CREATE INDEX "temporary_credential_issuances_initiated_by_user_id_prepared_at_idx"
  ON "temporary_credential_issuances"("initiated_by_user_id", "prepared_at");
CREATE INDEX "temporary_credential_issuances_delivered_by_user_id_delivered_at_idx"
  ON "temporary_credential_issuances"("delivered_by_user_id", "delivered_at");

ALTER TABLE "temporary_credential_issuances"
  ADD CONSTRAINT "temporary_credential_issuances_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "temporary_credential_issuances_initiated_by_user_id_fkey"
  FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "temporary_credential_issuances_delivered_by_user_id_fkey"
  FOREIGN KEY ("delivered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "temporary_credential_issuances_superseded_by_id_fkey"
  FOREIGN KEY ("superseded_by_id") REFERENCES "temporary_credential_issuances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
