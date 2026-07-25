# Bug — Pin/unpin from the task detail page doesn't update the topbar

**Date:** 2026-07-24
**Item:** #7
**Solution doc:** `2026-07-24-solution-detail-page-pin-doesnt-update-topbar.md`

## Symptom

Pinning or unpinning a task from the **task detail page** leaves the topbar's pinned-tasks strip unchanged — the new tab doesn't appear (or a removed one doesn't disappear) until a full reload or up to 60 seconds later. Doing the same thing from the **list page** updates the strip instantly.

## Where

- Handler: `handleTogglePin` in `app/(app)/[workspaceId]/task/[taskId]/_components/task-detail-page.tsx`
- Working comparison: `handleTogglePersonalPin` in `components/task/task-list-row.tsx`
- Consumer: `PinnedTasksBar` in `components/workspace/workspace-shell.tsx`

## Root cause

**Not** a missing `refreshWorkspace` — the topbar strip is not server-rendered at all, so no amount of `revalidatePath` or SSE `data_changed` would have helped it.

`PinnedTasksBar` is a client component that reads its data from SWR:

```tsx
const swrKey = `/api/workspaces/${workspaceId}/pinned-tasks`;
const { data } = useSWR<{ pinnedTasks: PinnedItem[] }>(swrKey, fetcher, { refreshInterval: 60_000 });
```

The only ways that strip changes are an SWR revalidation of that key or the 60-second poll. The list row already does the former after a successful toggle:

```tsx
if (res.ok) {
  void mutate(`/api/workspaces/${workspaceId}/pinned-tasks`);
}
```

The detail page's handler had no such call — it wrote the pin via `fetch` and updated only its own local `isPinned` state:

```tsx
const res = await fetch(`/api/tasks/${taskId}/pin`, { method: next ? "POST" : "DELETE" });
if (!res.ok) {
  setIsPinned(!next);
  const data = await res.json().catch(() => ({}));
  console.error("Pin toggle failed:", data.error);   // failures were silent to the user, too
}
```

So the write succeeded and the button flipped, while the topbar kept serving its stale SWR cache — exactly the "list page works, detail page doesn't" split that was reported.

A second, smaller gap in the same handler: the topbar's own unpin broadcasts a `task-personal-unpin` window event that mounted `TaskListRow`s listen for, so their pin markers clear immediately. Unpinning from the detail page fired no such event, leaving any mounted list row showing a stale pin.
