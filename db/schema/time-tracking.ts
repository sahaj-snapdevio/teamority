import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { task } from "./task";
import { workspace } from "./workspace";

// A single time entry against a task. A row with `endTime` NULL is a *running*
// timer; the live clock ticks client-side and only the start/stop/log/delete
// mutations touch this table (never a per-second write). `durationSeconds` is
// NULL while running and set on stop (or immediately for a manual log).
export const timeEntry = pgTable(
  "time_entry",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    // Denormalized so we can find "my running timer" and scope realtime without
    // a join back through task.
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("time_entry_task_id_idx").on(t.taskId),
    // At most one running timer per user, enforced by the DB (the app also
    // auto-stops the previous one on start).
    uniqueIndex("time_entry_one_running_uq")
      .on(t.userId)
      .where(sql`end_time is null`),
  ],
);
