# Bug: Bulk task actions had broken notifications (missing, then flooding)

**Date:** 2026-07-22
**Area:** Bulk task actions — `app/actions/task.ts`
(`bulkUpdateStatus`, `bulkDeleteTasks`, `bulkArchiveTasks`, `bulkMoveTasks`),
`app/actions/task-assignee.ts` (`bulkAssignTasks`)

This covers two related issues found and fixed in the same session, in the
same code.

## Issue 1 — no notification or activity log at all

### Symptom
Changing a single task's status notifies its watchers ("X changed status of
'Task' to 'Done'") and writes a `status_changed` activity log entry.
Selecting multiple tasks in the Bulk Action Bar and changing their status
together did neither — no notification reached watchers, and nothing showed
up in the task's activity feed. Reported specifically for bulk status
change; investigating the code turned up the identical root cause in three
other bulk actions.

### Where
- `bulkUpdateStatus` vs. its single-task equivalent `updateTaskStatus` — the
  single-task version writes a `"status_changed"` activity log entry and
  notifies watchers with `task_status_changed` (or `task_completed` when the
  new status is a CLOSED-type status); the bulk version did neither.
- `bulkDeleteTasks` vs. `deleteTask` — single notifies assignees + watchers
  (`task_deleted`); bulk did not.
- `bulkArchiveTasks` vs. `archiveTask` — single writes a `"task_archived"`
  activity log entry (no notification, by design); bulk wrote neither.
- `bulkMoveTasks` vs. `moveTask` — single notifies assignees + watchers
  (`task_moved`) in addition to writing the activity log; bulk already wrote
  the activity log per task but never notified.

### Root cause
Every bulk action does its core write as a single raw SQL statement (or, for
`bulkMoveTasks`, a per-task loop) but was written without carrying over the
activity-log/notification side effects its single-task sibling has — those
were simply never added when the bulk actions were built, not broken by a
later change.

## Issue 2 — notification flood, introduced by the Issue 1 fix

### Symptom
After fixing Issue 1, changing the status of 3 selected tasks at once, where
a watcher watches all 3, produced 3 separate notification rows/toasts for
that watcher instead of one. Same problem for bulk delete, bulk move, and
bulk assign — any recipient present in multiple affected tasks' recipient
sets got flooded with one notification per task.

### Where
`bulkUpdateStatus`, `bulkDeleteTasks`, `bulkMoveTasks`
(`app/actions/task.ts`) and `bulkAssignTasks` (`app/actions/task-assignee.ts`)
each loop over their affected tasks and call `createNotifications()` once
per task, scoped to that task's own recipient set.

### Root cause
The Issue 1 fix correctly matched each bulk action's single-task
notification behavior, but did so with a per-task loop, so a recipient
appearing in several of the loop's iterations got one `notification` row per
iteration rather than one for the whole bulk operation. `createNotifications`
itself has no cross-call merge/dedup logic, so nothing collapsed the
duplicates automatically.
