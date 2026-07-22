# Bug: Breadcrumb parent items are not clickable

**Date:** 2026-07-21
**Area:** Task detail page and global topbar breadcrumb —
`app/(app)/[workspaceId]/task/[taskId]/_components/task-detail-page.tsx`,
`components/workspace/workspace-shell.tsx`, `lib/topbar-context.tsx`

## Symptom
On the task detail page, the breadcrumb reads `List > Task Title` (or
`Sprint > Task Title` when opened from a sprint). The back arrow correctly
returns to the parent list/sprint view, but clicking the "List"/"Sprint"
text itself does nothing. The same pattern exists in the app-wide topbar
breadcrumb (the workspace name shown above a list/sprint's title, and the
space name shown above a list's title) — every crumb except the final
title was inert.

## Where
- `app/(app)/[workspaceId]/task/[taskId]/_components/task-detail-page.tsx`
  — the in-page breadcrumb row (~line 843-874) rendered the list/sprint
  label as a bare `<span>{listName}</span>`, while the sibling parent-task
  crumb a few lines below it was already a clickable `<button>`.
- `components/workspace/workspace-shell.tsx` — the shared topbar breadcrumb
  rendered every `crumb.label` as a plain `<span>`, with no way for a
  caller to attach a destination.
- `lib/topbar-context.tsx` — `TopbarState.breadcrumbs` only carried
  `{ label, color }`, so there was no `href` for callers to pass even if
  the renderer supported it.

## Root cause
The breadcrumb "parent" segments were built as passive labels from the
start — only the back arrow and the deepest parent-task crumb were wired
to navigation. Nothing was broken by a recent change; the parent crumbs
were simply never made interactive, so `List`/`Sprint` and the workspace/
space name crumbs looked like links (same row, same styling family) but
had no `onClick`/`href`.
