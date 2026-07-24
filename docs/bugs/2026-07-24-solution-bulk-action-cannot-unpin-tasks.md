# Solution — Bulk action can't unpin tasks

**Date:** 2026-07-24
**Bug:** `2026-07-24-bug-bulk-action-cannot-unpin-tasks.md`

## What changed

All changes are in
`app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-view.tsx`.
The shared pin action was **not** modified — see "Why the server side is
untouched" below.

### 1. Pinned rows are really selectable

`PinnedSection` now takes `selectedIds` and `onSelect` and passes them straight
through to `TaskListRow`, exactly as `StatusGroup` already did:

```tsx
onSelect={onSelect}
selected={selectedIds.has(t.id)}
```

It also grew a **select-all checkbox in its header**, matching the status-group
header. Without it there was no way to grab the pinned set as a group — pinned
tasks are excluded from every status group, so the existing group-level
select-all could never reach them.

### 2. The selection is split by pin state

`ListView` derives two arrays and hands them to the bar:

```ts
const { pinnedSelectedIds, unpinnedSelectedIds } = React.useMemo(() => {
  …
  for (const t of [...pinnedTasks, ...localTasks]) { … }
}, [pinnedTasks, localTasks, selectedIds]);
```

Iterating **both** arrays is the load-bearing detail. The page serves pinned
tasks in `pinnedTasks` and filters them out of `tasks`, so reading only
`localTasks` would classify every selection as unpinned and leave bulk unpin
with an empty target — the original symptom.

### 3. Pin and Unpin are two buttons, not one toggle

`BulkActionBar` renders **Pin (n)** and **Unpin (n)** independently, each shown
only when the selection actually contains tasks in that state (and only when
`canPinToList` is set). A mixed selection shows both.

A single "toggle pin" button was deliberately rejected: with a mixed selection
it has no well-defined meaning, and it is exactly the shape of control that
produces "I clicked it and nothing happened".

### 4. Batching helper

```ts
async function setListPinBatch(taskIds: string[], pinned: boolean)
```

drives the existing route once per task and returns `{ succeeded, failures }`.

It is **sequential on purpose.** `pinTaskToList` enforces a 5-per-list cap with
a read-then-write inside its transaction; issuing the requests in parallel would
let a batch race past the limit. Partial success is reported honestly — the
first failure is surfaced via `toast.error` while the tasks that did succeed
still count.

### 5. Refresh + undo

- The route already calls `refreshWorkspace(workspaceId, …)` per task, which
  does the `revalidatePath` + `data_changed` broadcast. The client still needs
  `router.refresh()` to re-render against the revalidated data, so the bar takes
  an `onRefresh` prop (the same thing `TaskListRow.handlePinToList` does).
- Both directions wrap up with `toastWithUndo`, consistent with the list's other
  reversible actions (archive / unarchive). Undo re-runs the batch in reverse
  over the ids that actually succeeded. A blocked undo (e.g. the pin limit was
  taken in the meantime) surfaces its error rather than failing silently.

## Why the server side is untouched

`POST` / `DELETE /api/tasks/:taskId/pin-to-list` and
`pinTaskToList` / `unpinTaskFromList` (`server/list-pin.ts`) are shared with the
task detail page and the single-row ⋯ menu. This fix drives the existing
per-task contract N times instead of adding a bulk endpoint, so **no signature
changed** and nothing else that pins tasks had to be re-verified.

## Files touched

- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-view.tsx`

## Verifying

1. Pin 2–3 tasks to the top of a list.
2. Select them from the PINNED group (row checkboxes, or the new header
   select-all).
3. The bulk bar shows **Unpin (n)** → click it. The tasks leave the PINNED group
   and reappear in their status groups; an "Unpinned n tasks" undo toast lands.
4. Select unpinned tasks → the bar shows **Pin (n)**; it still works.
5. Select a mix of pinned and unpinned → both buttons appear with correct counts.
6. Select 6+ unpinned tasks and Pin → the first 5 pin, the rest report the list
   pin-limit error.
