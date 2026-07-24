# Solution — Commit and close Board card pickers on the option click

**Date:** 2026-07-24
**Item:** #16

## What changed

All in `CardContent` (`board-view.tsx`).

### Assignee picker

Assignees now render from local state instead of straight off the `task` prop:

```ts
const [localAssignees, setLocalAssignees] = React.useState(task.assignees);
React.useEffect(() => setLocalAssignees(task.assignees), [task.assignees]);
```

`handleToggleAssignee` was reordered to *show the result first*:

1. compute the next list optimistically (looking the member's name/image up from `members` for the added case);
2. `setAssigneeOpen(false)` + clear the member search;
3. await `addAssignee` / `removeAssignee`;
4. on `{ error }`, restore the captured `previous` list and `toast.error`; otherwise `onRefresh()`.

Every read of `task.assignees` in the card body — the trigger's avatar stack and `+N` chip, the `assigned` check on each option row, and the read-only (`!canEdit`) stack — now reads `localAssignees`.

### "More" menu (Duplicate, Archive, Copy link, Copy ID, Delete)

The `<Popover>` became controlled via a new `menuOpen` state, and every item calls `setMenuOpen(false)` before running its action. Delete closes the menu and *then* opens the confirm `Dialog`, so the two overlays never stack.

## Files touched

- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/board-view.tsx`

## Why it works

The perceived bug was a visibility problem, so the fix is about ordering, not about the mutation. Closing the popover synchronously on click uncovers the card immediately, and the optimistic `localAssignees` update means the avatar has already changed by the time it's uncovered — the server round-trip and `router.refresh()` now only confirm what the user can already see.

The `useEffect` re-sync is safe against clobbering the optimistic value: `BoardView` holds tasks in `localTasks`, and its drag handlers (`arrayMove`, and the cross-column `map`) preserve object identity for untouched tasks, so `task.assignees` keeps the same array reference until a genuine server refresh replaces it.

Reverting on error uses the `previous` list captured before the optimistic write rather than `task.assignees`, so a failure in the middle of two quick toggles rolls back to the right state.

No server action changed — `addAssignee` / `removeAssignee` / `duplicateTask` already call `refreshWorkspace` themselves (per CLAUDE.md's Real-time Sync rule), and the shared duplicate flow used by List View is untouched.
