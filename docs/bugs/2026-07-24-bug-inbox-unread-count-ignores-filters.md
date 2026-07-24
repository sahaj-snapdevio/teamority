# Bug — Inbox unread count doesn't change when a workspace filter is applied

**Date:** 2026-07-24
**Item:** #15

## Symptom

In the Inbox, picking a workspace from the Workspace filter correctly narrows the list — but the blue **unread** badge next to the "Inbox" heading, and the count on the **Unread** tab, both keep showing the global unread total.

So the page can read "Inbox 12" while the filtered list holds two unread rows, and clicking **Unread** then shows two items under a badge that still says 12. The same mismatch happens with the Date, Event and search filters.

## Where

- `app/api/me/notifications/route.ts` — the `GET` handler.
- `app/(app)/[workspaceId]/notifications/page.tsx` — consumes `data.unreadCount` for both badges.

## Root cause

The route built one `conditions` array from every active filter and used it for the list query and the `totalCount` query — but the unread query ignored it entirely:

```ts
db.select({ count: count() })
  .from(notification)
  .where(and(
    eq(notification.recipientId, userId),
    eq(notification.isRead, false),
  )),
```

Recipient + unread, nothing else. `workspace`, `event`, `after`/`before` and `q` never reached it, so `unreadCount` was always the account-wide unread total no matter what the page was showing.

The client is not at fault: the SWR key already includes every filter, so a filter change does refetch — it just got the same global number back each time. The optimistic `patchNotifications` decrements were correct too; they were adjusting a number that started out meaning something else.

There's a second, subtler part to the same query: the free-text `q` filter matches against `user.name` and `workspace.name`, which are only reachable through the two `leftJoin`s the list query performs. Any fix that reuses the filter conditions must reuse those joins as well.
