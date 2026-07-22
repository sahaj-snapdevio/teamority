# Solution: Inbox notification skeleton loader persists after the empty state renders

**Date:** 2026-07-22
**Area:** Inbox — `app/(app)/[workspaceId]/notifications/page.tsx`

## What changed
1. Added an effect that calls `setSize(1)` whenever any filter dependency
   (`activeTab`, `q`, `workspaceFilter`, `eventFilter`, `dateFilter`) changes —
   actually fulfilling the pre-existing comment's stated intent that a filter
   change resets pagination to page 1. This prevents the stale, never-fetched
   trailing page slot from existing in the first place.
2. Defensively added `!isReachingEnd` to the `isLoadingMore` condition, so
   the "loading more" skeleton can't render once the list has already been
   determined to be fully loaded, independent of the `size` reset above.
3. Reordered `isReachingEnd`/`lastPage` above `isLoadingMore` since the
   latter now reads the former.

## Why it works
Resetting `size` on filter change means every new filter starts pagination
fresh — there's no leftover page slot from a previous, longer result set for
`isLoadingMore` to misread as "still loading." The `!isReachingEnd` guard is
a second, independent safeguard: even if `data`'s trailing slot were ever
`undefined` for some other reason, the loader now can't show once the app
already knows there's nothing more to fetch. Both `isLoadingInitial` and
`isLoadingMore` (each gating their own `NotificationSkeletons` render) are
now `false` once loading truly completes, and only the empty state renders.

## Files touched
- `app/(app)/[workspaceId]/notifications/page.tsx`
