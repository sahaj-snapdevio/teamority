ALTER TABLE "user" ADD COLUMN "appearance_mode" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" DROP COLUMN "appearance_mode";