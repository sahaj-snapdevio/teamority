# Solution: Bulk task actions had broken notifications (missing, then flooding)

**Date:** 2026-07-22
**Area:** Bulk task actions

## Fix for Issue 1 — add the missing notification/activity log

For each of the four bulk actions, the core mutation stayed a single bulk
SQL statement (status/archive) or the existing per-task loop (move) — only
the activity-log/notification side effects were added, snapshotting whatever
data is needed (title, previous status, recipients) in one batch query
*before* the mutation runs, since some of it (e.g. deleted rows, previous
status) is unavailable afterwards.

1. **`bulkUpdateStatus`** — pre-fetches each task's title + previous status
   (with name), scoped to the space. After the update, for tasks whose
   status actually changed: writes a `"status_changed"` activity log entry
   and notifies that task's watchers (fetched via one batched query, not
   per-task) with `task_status_changed`, or `task_completed` when the new
   status's `type` is `CLOSED` — matching `updateTaskStatus` exactly.
2. **`bulkDeleteTasks`** — snapshots titles + assignee/watcher recipients
   (one batched query per relation) before the delete, then notifies each
   task's assignees + watchers with `task_deleted`, including the same
   `pushTitle`/`pushBody`/`pushUrl` fields `deleteTask` sends.
3. **`bulkArchiveTasks`** — pre-fetches the valid (space-scoped) task ids,
   then writes a `"task_archived"` activity log entry per task after the
   update. No notification is added, matching `archiveTask`, which doesn't
   send one either.
4. **`bulkMoveTasks`** — already looped per task and wrote activity logs;
   added a `createNotifications` call (assignees + watchers, `task_moved`)
   inside that existing loop, reusing the same from/to list name title
   format as `moveTask`.

## Fix for Issue 2 — aggregate per recipient instead of per task

New shared helper, `createBulkNotifications()` in
`lib/notifications/create-bulk-notifications.ts` (new file, kept separate
from `create-notification.ts`, which stays untouched and single-purpose for
its ~10+ existing single-task callers):
- Takes a list of affected tasks, each with its own `recipientIds` and a
  caller-defined `data` payload (e.g. `{ title }`).
- Runs one batched `mutedEntity` query for the whole operation, then inverts
  the task→recipients list into recipient→tasks, dropping only the
  individual (recipient, task) pairs that recipient has muted — not their
  whole notification.
- Calls the **existing** `createNotifications()` once per unique recipient,
  passing that recipient's own subset of tasks to a caller-supplied
  `buildMessage()` closure, which decides the copy: the N=1 case reproduces
  the exact single-task string from the Issue 1 fix, N>1 uses count-based
  phrasing (e.g. `"{actor} changed status of 3 tasks to \"Done\""`) with the
  affected task titles (capped at 5) placed in the notification's `body`
  field.
- Picks the first task in that recipient's group as the representative
  `entityId` for click-through navigation — matches how
  `getNotificationTarget()` already needs a single entity id.

All four call sites (`bulkUpdateStatus`, `bulkDeleteTasks`, `bulkMoveTasks` in
`app/actions/task.ts`; `bulkAssignTasks` in `app/actions/task-assignee.ts`)
were restructured the same way: their existing per-task loop (still driving
`writeActivityLog`, unchanged) now pushes into a `bulkTasks` array instead of
calling `createNotifications` directly, followed by one
`createBulkNotifications` call after the loop. `bulkMoveTasks`'s aggregated
title additionally drops the "from X" clause when a recipient's grouped
tasks came from different source lists. `bulkAssignTasks` builds two
independent groups/calls (`task_assigned` / `task_unassigned`) since those
remain distinct trigger types.

`bulkArchiveTasks` needed no change in either fix — it never sent a
notification (matches its single-task equivalent `archiveTask`), so there
was nothing to aggregate.

## Why it works
Each bulk action now produces the exact same downstream effects (activity
feed entry + notification, same trigger type, same recipient set, same title
text) as running the single-task action once per selected task — computed
from batched queries instead of a query-per-task, and collapsed to one
notification per recipient regardless of how many of their tasks were
affected. No schema/migration changes: `notification.entityType` stays
`"TASK"` and `entityId` stays a single representative task id; the "N tasks"
detail lives in the already-existing free-text `body` column.
`createNotifications()` itself is completely unchanged — every single-task
action (`updateTaskStatus`, `deleteTask`, `archiveTask`, `moveTask`,
`addAssignee`, `removeAssignee`) and `getNotificationTarget()`/the
notification UI continue to work exactly as before, since they're not part
of either fix. The N=1 branch in each `buildMessage` reproduces the
pre-existing string byte-for-byte, so a bulk operation that only ends up
notifying a recipient about one task is visually identical to a single-task
action.

## Files touched
- `app/actions/task.ts` — `bulkUpdateStatus`, `bulkDeleteTasks`,
  `bulkArchiveTasks`, `bulkMoveTasks`.
- `app/actions/task-assignee.ts` — `bulkAssignTasks`.
- `lib/notifications/create-bulk-notifications.ts` — new file,
  `createBulkNotifications` helper (Issue 2 fix only).

## Known follow-ups (not done here)
- `bulkDeleteTasks` still doesn't clean up attachment storage objects before
  deleting (`deleteTask` does, via `storage.delete`) — pre-existing gap, out
  of scope for this fix.
- The mute pre-filter in `createBulkNotifications` matches on `entityId`
  only (mirroring `create-notification.ts`'s own existing mute-check query,
  which also ignores `entityType`) — collision risk is negligible since ids
  are cuid2/uuid, consistent with pre-existing behavior.
