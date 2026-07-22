# Solution: No bulk-assign action for multiple selected tasks

**Date:** 2026-07-22
**Area:** List view Bulk Action Bar

## Fix
1. **New server action** — `bulkAssignTasks(workspaceId, spaceId, listId,
   taskIds, assigneeUserIds, mode)` in `app/actions/task-assignee.ts`, next
   to the existing single-task `addAssignee`/`removeAssignee`:
   - Checks edit-level space permission once for the whole batch (not per
     task).
   - Verifies every selected assignee is an active workspace member with a
     single batch query.
   - Scopes to tasks that actually belong to the given space, so stale/
     foreign task ids from the client are silently dropped rather than
     acted on.
   - Supports two modes: `"replace"` (clears each task's existing
     assignees first) and `"add"` (keeps existing assignees, adds the new
     ones).
   - Writes the assignee/watcher rows as bulk `INSERT`/`DELETE` statements
     inside one `db.transaction` — not a per-task loop — so it scales with
     one round trip regardless of selection size.
   - Diffs the new assignee set against each task's prior assignees so
     activity-log entries (`assignee_added`/`assignee_removed`) and
     `task_assigned`/`task_unassigned` notifications are only written for
     users actually added or removed, matching the granularity of the
     single-task actions.
   - Auto-adds newly assigned members as watchers, same as `addAssignee`.

2. **UI** — `BulkActionBar` in `list-view.tsx` gained an "Assign" button
   (first in the toolbar) opening a "Bulk Assign" dialog:
   - The member picker reuses the existing `FacetOptionList`
     (`components/filters/facet-filter.tsx`) + `UserAvatar` — the same
     searchable-checkbox-list pattern already used for assignee selection
     during quick task creation (`quick-task-meta.tsx`). No new picker
     component was built.
   - The Replace/Add mode toggle reuses the existing shadcn `RadioGroup`,
     the same pattern used in `close-sprint-modal.tsx`.
   - Apply is disabled until at least one member is selected; on success,
     shows a toast, clears the selection, and lets the existing
     `refreshWorkspace` realtime pipeline pick up the change.

## Why it works
The core mutation (assignee rows across N tasks) is a fixed number of SQL
statements regardless of how many tasks are selected, satisfying the "don't
send one request per task" requirement, while the activity-log/notification
fan-out — deliberately kept per-task for correct history/inbox
granularity — is best-effort and outside the transaction, consistent with
how every other action in this codebase treats those two concerns.

## Files touched
- `app/actions/task-assignee.ts` — added `bulkAssignTasks` + `BulkAssignMode`.
- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-view.tsx`
  — added the Assign button, Bulk Assign dialog, and wired `members` into
  `BulkActionBar`.

## Known follow-ups (not done here)
- The near-duplicate `BulkActionBar` in `sprint-list-view.tsx` does not have
  an Assign button yet — same pattern would need to be repeated there for
  parity in the Sprint view.
- `BulkActionBar` remains a hardcoded list of actions (no generic bulk-action
  framework); adding Priority/Move/Due Date/Tags as bulk actions later means
  repeating this same action+dialog pattern rather than plugging into a
  registry.
