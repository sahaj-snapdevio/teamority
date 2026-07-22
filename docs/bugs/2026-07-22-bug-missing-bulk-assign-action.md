# Bug: No bulk-assign action for multiple selected tasks

**Date:** 2026-07-22
**Area:** List view Bulk Action Bar —
`app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-view.tsx`,
`app/actions/task-assignee.ts`

## Symptom
Selecting multiple tasks in the List view (via row checkboxes) surfaces the
Bulk Action Bar with Status, Move (Sprint/List), Archive, and Delete — but no
way to assign members to more than one task at a time. Assigning several
tasks to the same person required opening each task individually and using
its own assignee picker, which does not scale for teams handling routine
reassignment (e.g. moving a batch of tickets to a new owner), unlike Jira,
Linear, ClickUp, and Asana, all of which support bulk-assign from a
multi-select toolbar.

## Where
- `BulkActionBar` in `list-view.tsx` (~line 797) already rendered Status,
  Move, Archive, and Delete buttons, each dispatching to an existing
  `bulk*` server action, but had no "Assign" button or dialog.
- `app/actions/task-assignee.ts` only exposed single-task `addAssignee` /
  `removeAssignee` — no bulk equivalent existed.

## Root cause
Bulk actions were added to the task list incrementally (status change,
move, archive, delete), but assignee editing was never extended to the
bulk-selection flow — it remained single-task-only. This wasn't a
regression; the capability was simply never built.
