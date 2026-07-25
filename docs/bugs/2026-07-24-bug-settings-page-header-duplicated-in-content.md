# Bug — Settings page headers render in the content area, leaving the topbar empty

**Date:** 2026-07-24
**Items:** #10 (List Settings), #14 (Notification Settings)

## Symptom

On List Settings the header block — "**{List} — Settings**" with the subtitle "Manage this List" — is rendered at the top of the page body, while the app topbar above it is completely blank. The same is true for Notification Settings ("Notification Settings" / "Control how and when you receive notifications."), Project Settings ("{Project} - Settings" / "Manage this Project") and Workspace Settings ("Workspace Settings").

Every other page in the app (List, Board, Sprint, Task detail, empty states) puts its title and breadcrumb in the topbar. The settings pages are the odd ones out: the topbar is dead space, and the content area starts with a header that pushes the actual settings down.

## Where

- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/settings/layout.tsx`
- `app/(app)/[workspaceId]/notifications/settings/page.tsx`
- `app/(app)/[workspaceId]/[spaceId]/settings/layout.tsx`
- `app/(app)/[workspaceId]/settings/layout.tsx`

## Root cause

The topbar title slot already exists and works: `TopbarProvider` / `useTopbarState` (`lib/topbar-context.tsx`) are rendered by `TopbarRightColumn` in `components/workspace/workspace-shell.tsx`, and pages fill it by calling the `useSetTopbar` hook.

The settings surfaces never adopted it, for a concrete reason: three of the four are **server components** (the layouts do the session + permission checks and the DB name lookup), and `useSetTopbar` is a React hook, so a server layout cannot call it. With no server-side way to reach the slot, each layout grew its own in-body `<h1>` instead.

The notification settings page is already a client component, so there it was pure oversight — it could have called the hook all along.
