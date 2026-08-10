# Solution: Task created from the Sprint overview's "Create task" quick-add lands with no status

## Fix

### `app/actions/sprint.ts`

Added `getDefaultListForSprint(workspaceId, spaceId, sprintId)`, backed by a
new `resolveDefaultListForSprint(spaceId, sprintId)` helper that mirrors
`getActiveSprintView`'s existing `defaultListId` logic but works for any
sprint (not just the active one):

1. Prefer the `listId` of a non-archived task already in this sprint
   (ordered by `task.orderIndex`).
2. Else fall back to the space's first non-archived list (ordered by
   `list.createdAt`).
3. Else `null` (space has no lists yet).

### `components/sprint/sprint-panel.tsx`

`QuickCreateSprintTask.submit()` now calls `getDefaultListForSprint` first
and passes the resolved `listId` into `createTask` instead of hard-coded
`null`:

```ts
const listRes = await getDefaultListForSprint(workspaceId, spaceId, sprintId);
const defaultListId = "error" in listRes ? null : listRes.listId;
const res = await createTask(workspaceId, spaceId, defaultListId, {
  title: trimmed,
});
```

## Why it works

Passing a real `listId` makes `createTask`'s existing default-status logic
run (`effectiveListId` is now truthy), so it looks up the list's first
`type: "OPEN"` status and assigns it — the task lands in "To Do" like every
other creation path, with no new prompt or UI added (per product decision:
don't ask the user which list, just resolve one automatically the same way
the sprint detail page's Create Task modal already does).
