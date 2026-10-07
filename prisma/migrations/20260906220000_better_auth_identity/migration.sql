-- Add Better Auth admin/session fields without rewriting existing identity data.
ALTER TABLE "users"
  ADD COLUMN "banned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ban_reason" TEXT,
  ADD COLUMN "ban_expires" TIMESTAMP(3);

ALTER TABLE "session"
  ADD COLUMN "impersonated_by" TEXT;

CREATE TABLE "rate_limit" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "last_request" BIGINT NOT NULL,
  CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rate_limit_key_key" ON "rate_limit"("key");
