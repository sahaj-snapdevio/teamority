ALTER TABLE "user_email_preference" ADD COLUMN "sound_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_email_preference" ADD COLUMN "sound_volume" integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_email_preference" ADD COLUMN "sound_type" text DEFAULT 'default' NOT NULL;