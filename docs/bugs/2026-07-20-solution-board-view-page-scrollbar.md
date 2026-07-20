# Solution: Board columns fit within main (no page scrollbar)

**Date:** 2026-07-20
**Bug:** [2026-07-20-bug-board-view-page-scrollbar.md](./2026-07-20-bug-board-view-page-scrollbar.md)

## Fix
Increased the board column max-height offset from `calc(100vh-11rem)` to
`calc(100vh-14rem)` in `board-view.tsx` (the `Column` wrapper) — adding the 3rem
(~48px) topbar height the previous value omitted.

## Files touched
- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/board-view.tsx`
  — one value in the column's `max-h-[calc(...)]`.

## Why it works
Columns now cap at `100vh - 14rem`, leaving enough room for the topbar (48px) plus
the in-`main` chrome (view tabs, toolbar, paddings). The board no longer exceeds
`<main>`'s height, so `<main>`'s vertical scrollbar disappears; each column still
scrolls internally via its own `overflow-y-auto`. No logic or data changes.

## Note
This keeps the existing viewport-calc approach (a fixed rem offset). If the
optional PushNotification / PinnedTasks bars are shown above `<main>`, they add
height that a fixed offset can't track — a future improvement would switch the
board to a flex-fill layout instead of a `100vh` calc.
