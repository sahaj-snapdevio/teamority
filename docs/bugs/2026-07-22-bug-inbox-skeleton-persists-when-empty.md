# Bug: Inbox notification skeleton loader persists after the empty state renders

**Date:** 2026-07-22
**Area:** Inbox — `app/(app)/[workspaceId]/notifications/page.tsx`

## Symptom
The "No notifications yet. You're all caught up." empty state renders
correctly, but skeleton placeholder rows keep showing below it instead of
disappearing once loading finishes.

## Where
`isLoadingMore` (`app/(app)/[workspaceId]/notifications/page.tsx`), which
gates the `NotificationSkeletons` block rendered after the notification list
(distinct from the initial-load skeleton gated by `isLoadingInitial`).

## Root cause
Pagination uses `useSWRInfinite` keyed off the active tab/search/date/
workspace/event filters (`getKey` → `buildUrl`). A pre-existing code comment
stated that changing any filter "resets pagination to page 1," but nothing
actually called `setSize(1)` — the `size` value SWRInfinite tracks persists
across key changes.

If a page had already been paginated past page 1 under one filter (e.g. "All"
with several loaded pages) and the user then switched to a filter yielding
fewer results (e.g. "Unread" with 0 matches, or any filter short enough to
fit on page 1), `size` stayed at its old value. The new key sequence only
resolves page 0 — subsequent page slots' keys resolve to `null` (via
`getKey`'s `prev.notifications.length < PAGE_SIZE` short-circuit) and are
never fetched, leaving `data[size - 1]` permanently `undefined`.

`isLoadingMore` was computed as:
```ts
!isLoadingInitial && size > 0 && !!data && typeof data[size - 1] === "undefined"
```
With a permanently-`undefined` trailing slot, this stayed `true` forever,
rendering the "loading more" skeleton indefinitely — simultaneously with the
correctly-shown empty state, since the two are otherwise independent
branches in the JSX.
