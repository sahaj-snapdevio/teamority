# Solution — In-place archived banner on the task detail page

**Date:** 2026-07-24
**Item:** #8
**Bug doc:** `2026-07-24-bug-archived-task-detail-leaves-the-page.md`

## What changed

One file: `app/(app)/[workspaceId]/task/[taskId]/_components/task-detail-page.tsx`.

### 1. Archiving stays on the page

```tsx
async function handleArchive() {
  await archiveTask(workspaceId, spaceId, listId, taskId);
  await load();                                  // was: router.push(backUrl)
  toastWithUndo("Task archived", async () => {
    await unarchiveTask(workspaceId, spaceId, listId, taskId);
    await load();
  });
}
```

The undo path also refetches instead of calling `router.refresh()`, so the banner disappears in place on undo.

### 2. New `handleUnarchive`

Calls `unarchiveTask`, surfaces `{ error }` via `toast.error`, refetches, and offers a symmetric `toastWithUndo("Task unarchived", …)`. Tracked by an `unarchiving` state flag for the button's pending label.

### 3. The banner

Rendered between the top bar and the two-column body, so it spans both columns and is visible no matter which column the user scrolls:

```tsx
{isArchived && (
  <div className="shrink-0 border-b px-5 py-3">
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-2.5 dark:bg-amber-950/30">
      <ArchiveIcon … weight="fill" />
      <p …>This task has been archived. <span …>It stays hidden from lists and boards until it&rsquo;s restored.</span></p>
      {canEdit && (
        <Button disabled={unarchiving} onClick={handleUnarchive} size="sm" variant="outline">
          <ArchiveIcon className="size-3.5" />
          {unarchiving ? "Restoring…" : "Unarchive"}
        </Button>
      )}
    </div>
  </div>
)}
```

`rounded-xl` surface, `rounded-md` shadcn `Button`, amber styled for both themes.

### 4. Light lock while archived

```tsx
const isArchived = t.isArchived;
const canEditNow = canEdit && !isArchived;
```

`canEditNow` replaces `canEdit` where it is passed down — `TaskTimeTracking`, `TaskDependencies`, `SubtaskRow`, `CustomFieldEditor` — and gates the title's click-to-edit affordance. The ⋯ menu's "Archive" item becomes "Unarchive" and calls `handleUnarchive`.

## Permission behaviour

`unarchiveTask` requires `requireEditAccess`, which is the same check behind `data.canEdit`. So the button is shown exactly when the action would succeed. A viewer without edit access sees the banner **without** the Unarchive button (the task file's stated default) — they keep read access to the task, its comments and its activity rather than being bounced to the list.

## Why it works

`getTaskDetail` already returns the full task row including `isArchived` and never filtered archived tasks out, so the state was available on the client all along — it simply had nothing rendering it. Reading it drives both the banner and `canEditNow` from one source of truth.

Realtime is unchanged and needs no new wiring: `archiveTask` / `unarchiveTask` already call `revalidateList` → `refreshWorkspace(workspaceId, …, { taskId })`. The detail page's `useRealtimeRefetch` handler refetches on any event carrying this `taskId`, so a teammate archiving or restoring the task makes the banner appear or disappear for anyone with the page open, and list/board views update through their existing `router.refresh()` path.

## Deliberately out of scope

Archived rows in the list's Archived section are still not clickable through to the detail page — `list-view.tsx` belongs to another agent's scope. Direct links, search results, notifications and pinned tabs all reach the page and now render correctly, which is what item #8 asked for.

## Behaviour change worth flagging

Title click-to-edit is now gated on `canEditNow`, so it is also disabled for **view-only** users, who previously got an edit affordance the server would have rejected. That is a fix in its own right, but it is a change beyond the archived case.
