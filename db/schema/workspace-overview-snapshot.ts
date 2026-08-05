import { integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";

// One row per (workspace, user, day) — written opportunistically the first
// time that user loads Workspace Overview on a given day. Lets the "vs
// yesterday" trend on the Overdue card compare against a real prior value
// instead of nothing — "overdue" is a derived state, not a logged event, so
// there is no other way to know what it was as of yesterday.
//
// Scoped per user (not just per workspace) because Overview's counts are
// permission-scoped — a Guest and an Owner can see different totals for the
// same workspace on the same day, so a single shared snapshot would produce
// a misleading delta for whichever role didn't write it.
export const workspaceOverviewSnapshot = pgTable(
  "workspace_overview_snapshot",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    snapshotDate: text("snapshot_date").notNull(), // "YYYY-MM-DD"
    totalTasks: integer("total_tasks").notNull(),
    completedTasks: integer("completed_tasks").notNull(),
    inProgressTasks: integer("in_progress_tasks").notNull(),
    overdueTasks: integer("overdue_tasks").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("workspace_overview_snapshot_unique").on(t.workspaceId, t.userId, t.snapshotDate),
  ],
);
