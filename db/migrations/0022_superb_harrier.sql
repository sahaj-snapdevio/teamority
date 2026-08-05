CREATE TABLE "workspace_overview_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"snapshot_date" text NOT NULL,
	"total_tasks" integer NOT NULL,
	"completed_tasks" integer NOT NULL,
	"in_progress_tasks" integer NOT NULL,
	"overdue_tasks" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_overview_snapshot_unique" UNIQUE("workspace_id","user_id","snapshot_date")
);
--> statement-breakpoint
ALTER TABLE "workspace_overview_snapshot" ADD CONSTRAINT "workspace_overview_snapshot_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;