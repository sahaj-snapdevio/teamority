# Bug — Archived task detail leaves the page instead of showing its state

**Date:** 2026-07-24
**Item:** #8
**Solution doc:** `2026-07-24-solution-archived-task-detail-leaves-the-page.md`

## Symptom

Reported as: opening an archived task's detail page redirects to the list page. Expected (ClickUp-style): stay on the detail page and show a "This task has been archived" banner with an **Unarchive** action.

## Where

- `app/(app)/[workspaceId]/task/[taskId]/page.tsx` (route guard)
- `app/(app)/[workspaceId]/task/[taskId]/_components/task-detail-page.tsx` (`handleArchive`)

## Root cause — two halves, only one of which is a redirect

**There is no archived-task redirect on the route.** `page.tsx` only guards on session, workspace membership, task existence and space access; `getTaskDetail` (`app/actions/task.ts`) selects the task with a plain `eq(task.id, taskId)` and no `isArchived` filter. Navigating straight to an archived task — from search, a notification, a pinned tab, or a pasted link — renders the page normally.

That is its own defect, and a worse one than the reported redirect: the page gave **no indication whatsoever** that the task was archived, and left every control live. A user could rename it, change its status, log time against it and comment on it while it stayed hidden from every list and board.

**The redirect the report describes comes from the archive action itself.** Archiving from the detail page's ⋯ menu ran:

```tsx
async function handleArchive() {
  await archiveTask(workspaceId, spaceId, listId, taskId);
  router.push(backUrl);            // ← leaves the page
  toastWithUndo("Task archived", async () => { … });
}
```

So the one flow that reliably puts a user on an archived task bounced them to the list mid-action, which is what "opening an archived task redirects to the list" describes from the user's side. Getting back was then effectively impossible: the list's Archived section renders archived rows as plain text with an Unarchive button and no navigation affordance, so nothing there links to the task's detail page.

Both halves resolve to the same fix — the detail page has to be able to *represent* the archived state, which it previously could not do at all.
