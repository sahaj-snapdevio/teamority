# Solution — Scope the Inbox unread count to the active filters

**Date:** 2026-07-24
**Item:** #15

## What changed

### `app/api/me/notifications/route.ts`

Split the single `conditions` array into two, which also settles what the number means:

- **`scopeConditions`** — recipient + Workspace + Event + date range + search `q`. These are the filters that persist while you move between tabs.
- **`conditions`** — `scopeConditions` plus the All / Unread / Mentions **tab** predicate. Used by the list and `totalCount` queries, exactly as before.

The unread query now runs against `scopeConditions` + `isRead = false`, with the same `leftJoin(user)` / `leftJoin(workspace)` the list query uses (required — the `q` filter reaches into `user.name` and `workspace.name`).

Semantics, stated in a comment on `scopeConditions`: **unreadCount = how many unread you'd see if you switched to the Unread tab with these same filters.** The tab deliberately does *not* narrow it, because the three tabs replace each other — scoping the badge by the Mentions tab would make the "Unread" badge describe a list you can't reach by clicking it.

### `app/(app)/[workspaceId]/notifications/page.tsx`

No logic change was needed — the SWR key already carries every filter, so the count refetches on filter change and stays live over SSE (`realtime-provider.tsx` mutates every key containing `/api/me/notifications`). Added a `title` on the header badge that says whether the number is scoped, plus a comment recording the semantics.

## Files touched

- `app/api/me/notifications/route.ts`
- `app/(app)/[workspaceId]/notifications/page.tsx`

## Why it works

Both badges read the one `unreadCount` field, so fixing it at the source fixes the header badge and the Unread tab badge together. On the Unread tab the count and `totalCount` now agree by construction — the two queries differ only by the tab predicate, which on that tab *is* `isRead = false`.

Existing optimistic updates stay correct: `patchNotifications` and `markAllRead` adjust `unreadCount` for rows in the current (filtered) page, and those rows are by definition inside the new scope.

**Other unread badges are unaffected.** `notification-bell.tsx`, `workspace-shell.tsx`'s sidebar badge, `notification-panel.tsx` and the channel page all call `/api/me/notifications?filter=unread` with no scope params, so their `scopeConditions` collapse to `recipientId` alone and they keep reporting the global unread total.
