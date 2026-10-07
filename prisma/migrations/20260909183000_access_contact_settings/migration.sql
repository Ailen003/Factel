CREATE TABLE "platform_settings" (
  "id" VARCHAR(32) NOT NULL DEFAULT 'public-access',
  "access_contact_email" VARCHAR(320) NOT NULL,
  "access_requests_enabled" BOOLEAN NOT NULL DEFAULT false,
  "updated_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_settings_updated_by_user_id_idx"
  ON "platform_settings"("updated_by_user_id");

ALTER TABLE "platform_settings"
  ADD CONSTRAINT "platform_settings_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
