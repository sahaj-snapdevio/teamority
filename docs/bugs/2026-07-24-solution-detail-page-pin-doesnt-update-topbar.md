# Solution — Detail-page pin revalidates the topbar's SWR key

**Date:** 2026-07-24
**Item:** #7
**Bug doc:** `2026-07-24-bug-detail-page-pin-doesnt-update-topbar.md`

## What changed

One file: `app/(app)/[workspaceId]/task/[taskId]/_components/task-detail-page.tsx`.

```tsx
import { useSWRConfig } from "swr";
// …
const { mutate } = useSWRConfig();

async function handleTogglePin() {
  const next = !isPinned;
  setIsPinned(next);
  const res = await fetch(`/api/tasks/${taskId}/pin`, { method: next ? "POST" : "DELETE" });
  if (res.ok) {
    void mutate(`/api/workspaces/${workspaceId}/pinned-tasks`);
    if (!next) {
      window.dispatchEvent(new CustomEvent("task-personal-unpin", { detail: { taskId } }));
    }
    return;
  }
  setIsPinned(!next);
  const err = await res.json().catch(() => ({}));
  toast.error(err.error ?? "Failed to update pin");
}
```

Three changes, all inside that handler:

1. `mutate` the topbar's SWR key on success — the same key and the same call the list row already makes.
2. Dispatch `task-personal-unpin` on unpin, matching what `PinnedTasksBar` broadcasts, so mounted list rows drop their pin marker too.
3. Replace the `console.error` on failure with `toast.error`, so a rejected pin is visible instead of silent (the optimistic flip was already being rolled back).

**`components/workspace/workspace-shell.tsx` is untouched.** The topbar needed no change — it already revalidates correctly when its key is invalidated. The pin server route and its request/response shape are also untouched, so the action shared with Agent B's bulk-unpin work is unaffected.

## Why it works

`useSWRConfig().mutate(key)` invalidates that key in the global SWR cache and triggers a refetch in every mounted subscriber. `PinnedTasksBar` subscribes to exactly `/api/workspaces/${workspaceId}/pinned-tasks`, so it refetches and re-renders as soon as the pin write returns — the same instant path the list page has always taken, rather than waiting on its `refreshInterval: 60_000` poll.

The key is built from the same template literal in both places. It is a plain string key (not an array/function key), so string equality is all that's required for the caches to line up.

## Why not `refreshWorkspace`

`CLAUDE.md` requires every **server-side mutation** to call `refreshWorkspace`, and the pin route already does whatever revalidation it owes. But the topbar strip is a client-side SWR resource, not a server-rendered path, so `revalidatePath` and the SSE `data_changed` broadcast can't reach it — SWR's cache is the only thing that feeds it. Adding a `refreshWorkspace` call here would not have fixed the reported symptom.
