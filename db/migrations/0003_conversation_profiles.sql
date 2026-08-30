ALTER TYPE "throttle_action" ADD VALUE IF NOT EXISTS 'participant_register';
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."conversation_profile_batch_status" AS ENUM('staged', 'active', 'superseded', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."conversation_profile_alias_kind" AS ENUM('canonical', 'approved_alias', 'discovered');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE "conversation_profile_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE cascade,
  "schema_version" text NOT NULL,
  "source_version" text NOT NULL,
  "selection_mode" text NOT NULL,
  "source_user_count" integer NOT NULL,
  "profile_count" integer NOT NULL,
  "merged_source_row_count" integer DEFAULT 0 NOT NULL,
  "payload_digest" text NOT NULL,
  "status" "conversation_profile_batch_status" DEFAULT 'staged' NOT NULL,
  "failure_reason" text,
  "imported_at" timestamptz DEFAULT now() NOT NULL,
  "activated_at" timestamptz,
  CONSTRAINT "conversation_profile_batches_counts_check" CHECK (source_user_count >= profile_count AND profile_count >= 1 AND merged_source_row_count >= 0),
  CONSTRAINT "conversation_profile_batches_digest_check" CHECK (payload_digest ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_profile_batches_id_event_uq" ON "conversation_profile_batches" ("id", "event_id");
CREATE UNIQUE INDEX "conversation_profile_batches_event_payload_uq" ON "conversation_profile_batches" ("event_id", "payload_digest");
CREATE UNIQUE INDEX "conversation_profile_batches_one_active_uq" ON "conversation_profile_batches" ("event_id") WHERE "status" = 'active';
CREATE INDEX "conversation_profile_batches_event_idx" ON "conversation_profile_batches" ("event_id");
--> statement-breakpoint
CREATE TABLE "conversation_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL REFERENCES "conversation_profile_batches"("id") ON DELETE cascade,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE cascade,
  "nickname_display" text NOT NULL,
  "nickname_key" text NOT NULL,
  "source_version" text NOT NULL,
  "source_digest" text NOT NULL,
  "source_row_count" integer DEFAULT 1 NOT NULL,
  "profile_data" jsonb NOT NULL,
  "claimed_participant_id" uuid REFERENCES "participants"("id") ON DELETE set null,
  "claimed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "conversation_profiles_batch_event_fk"
    FOREIGN KEY ("batch_id", "event_id")
    REFERENCES "conversation_profile_batches"("id", "event_id") ON DELETE cascade,
  CONSTRAINT "conversation_profiles_source_rows_check" CHECK (source_row_count >= 1),
  CONSTRAINT "conversation_profiles_digest_check" CHECK (source_digest ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_profiles_id_batch_uq" ON "conversation_profiles" ("id", "batch_id");
CREATE UNIQUE INDEX "conversation_profiles_batch_nickname_uq" ON "conversation_profiles" ("batch_id", "nickname_key");
CREATE UNIQUE INDEX "conversation_profiles_claimed_participant_uq" ON "conversation_profiles" ("claimed_participant_id") WHERE "claimed_participant_id" IS NOT NULL;
CREATE INDEX "conversation_profiles_batch_idx" ON "conversation_profiles" ("batch_id");
CREATE INDEX "conversation_profiles_event_idx" ON "conversation_profiles" ("event_id");
--> statement-breakpoint
CREATE TABLE "conversation_profile_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL REFERENCES "conversation_profile_batches"("id") ON DELETE cascade,
  "profile_id" uuid NOT NULL REFERENCES "conversation_profiles"("id") ON DELETE cascade,
  "display_alias" text NOT NULL,
  "alias_key" text NOT NULL,
  "kind" "conversation_profile_alias_kind" NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "conversation_profile_aliases_profile_batch_fk"
    FOREIGN KEY ("profile_id", "batch_id")
    REFERENCES "conversation_profiles"("id", "batch_id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_profile_aliases_batch_key_uq" ON "conversation_profile_aliases" ("batch_id", "alias_key");
CREATE INDEX "conversation_profile_aliases_profile_idx" ON "conversation_profile_aliases" ("profile_id");
--> statement-breakpoint
ALTER TABLE "avatar_assignments"
  ADD COLUMN "conversation_profile_id" uuid
  REFERENCES "conversation_profiles"("id") ON DELETE set null;
CREATE UNIQUE INDEX "avatar_participant_source_digest_uq"
  ON "avatar_assignments" ("participant_id", "source_kind", "source_digest");
