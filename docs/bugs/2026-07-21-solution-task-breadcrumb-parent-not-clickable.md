# Solution: Breadcrumb parent items are not clickable

**Date:** 2026-07-21
**Area:** Task detail page and global topbar breadcrumb

## Fix
1. **Task detail page in-page breadcrumb**
   (`app/(app)/[workspaceId]/task/[taskId]/_components/task-detail-page.tsx`):
   the `List`/`Sprint` `<span>` is now a `<button>` styled like the existing
   parent-task crumb, navigating via `router.push(listBackUrl)` — the same
   URL the back arrow already used (respects `?from=` / `?sid=` so the
   destination view mode is preserved). Its label now uses `contextLabel`
   instead of the raw `listName`, so it reads "Sprint" when opened from a
   sprint view, matching the topbar breadcrumb's existing label logic.

2. **Shared topbar breadcrumb** (`lib/topbar-context.tsx` +
   `components/workspace/workspace-shell.tsx`): added an optional `href`
   field to `TopbarState.breadcrumbs`. The renderer now wraps a crumb in a
   `next/link` `Link` (with the same hover style as the title) when `href`
   is present, falling back to the previous inert `<span>` otherwise —
   existing callers that don't pass `href` are unaffected.

3. **Wired up `href` on existing crumb callers** that represent a real
   parent entity:
   - `list-container.tsx` — space-name crumb → `/${workspaceId}/${space.id}`
     (the space landing page).
   - `sprint-page-client.tsx` — space-name crumb → same space landing page.
   - `task-detail-page.tsx` topbar breadcrumb — workspace-name crumb →
     `/${workspaceId}`.

   Static/non-entity crumbs (e.g. the "Projects" label on empty-workspace
   states) were left as-is since they don't point to a distinct parent
   view.

## Why it works
Every breadcrumb segment now uses the same navigation target the
corresponding back-arrow/router already computes, so "click the crumb" and
"click the back arrow" are equivalent for view mode, filters carried via
the `?view=`/`?from=`/`?sid=` query params, and space/workspace targets.
No new state was introduced — `listBackUrl` was already memo'd from route
params + search params, so reusing it keeps behavior identical to the
existing back-arrow round trip (view mode preserved; filters/sort/scroll
position are not persisted anywhere in the app today, so this fix doesn't
change that pre-existing scope).

## Files touched
- `app/(app)/[workspaceId]/task/[taskId]/_components/task-detail-page.tsx`
- `lib/topbar-context.tsx`
- `components/workspace/workspace-shell.tsx`
- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-container.tsx`
- `app/(app)/[workspaceId]/[spaceId]/sprint/[sprintId]/_components/sprint-page-client.tsx`
