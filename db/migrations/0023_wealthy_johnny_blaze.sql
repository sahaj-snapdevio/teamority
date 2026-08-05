CREATE TYPE "public"."dashboard_category" AS ENUM('OPEN', 'WORKING', 'REVIEW', 'COMPLETED');--> statement-breakpoint
ALTER TABLE "list_status" ADD COLUMN "dashboard_category" "dashboard_category" DEFAULT 'OPEN' NOT NULL;--> statement-breakpoint
-- Backfill existing statuses into the new analytics-only category. Priority:
-- (1) the existing `type` enum, already the source of truth for workflow
-- behavior, (2) a narrower name-based override for conventionally-named
-- review statuses, (3) the column default 'OPEN' for everything else. Every
-- statement is a deterministic UPDATE ... WHERE — safe to re-run, and this
-- file only ever executes once as part of applying this migration, so a
-- user's later manual category choice is never touched again by it.
UPDATE "list_status" SET "dashboard_category" = 'WORKING' WHERE "type" = 'ACTIVE';--> statement-breakpoint
UPDATE "list_status" SET "dashboard_category" = 'COMPLETED' WHERE "type" = 'CLOSED';--> statement-breakpoint
UPDATE "list_status" SET "dashboard_category" = 'REVIEW' WHERE lower(trim("name")) IN ('review', 'qa', 'testing', 'uat');