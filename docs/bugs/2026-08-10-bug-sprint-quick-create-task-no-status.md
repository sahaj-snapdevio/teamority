# Bug: Task created from the Sprint overview's "Create task" quick-add lands with no status

## Symptom

On the Sprint overview page, each sprint card has an inline "+ Create task"
/ "New task" quick-add. Typing a title and submitting created the task
successfully, but it always landed in "No Status" instead of the list's
default (To Do) status — even though task creation from the List/Board view
or the sprint detail page's "Create Task" modal correctly defaults to the
first open status.

## Where

- `components/sprint/sprint-panel.tsx` — `QuickCreateSprintTask.submit()`
- `app/actions/task.ts` — `createTask`

## Root cause

`QuickCreateSprintTask.submit()` called `createTask(workspaceId, spaceId, null, { title })` — hard-coding `listId` to `null` and passing no `statusId`.

In `createTask`, the entire default-status resolution (querying `listStatus`
for the list's first `type: "OPEN"` row) is gated behind
`if (effectiveListId)`. With `listId: null`, that block never runs, so the
task is inserted with both `listId: null` and `statusId: null`.

`addTaskToSprint` (called right after, to link the new task to the sprint)
only inserts a `taskSprint` join row — it never sets `task.listId` or
`task.statusId`, so the task stays list-less/status-less indefinitely.

This happens because a sprint isn't tied to a single list — it can contain
tasks from multiple lists — so the quick-add had no obvious single list to
create the task in, and simply didn't try. The rest of the codebase already
solves this exact ambiguity: `getActiveSprintView` (`app/actions/sprint.ts`)
computes a `defaultListId` (prefer a list already used by the sprint's
tasks, else the space's first non-archived list) so the sprint detail
page's "Create Task" modal always has a real list/status to default to.
`QuickCreateSprintTask` had no equivalent.

See `2026-08-10-solution-sprint-quick-create-task-no-status.md`.
