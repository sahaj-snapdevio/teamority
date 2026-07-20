# Bug: Board view shows an unwanted page (main) vertical scrollbar

**Date:** 2026-07-20
**Area:** Board view — `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/board-view.tsx`

## Symptom
On the Board view, a vertical scrollbar appears on the right edge of the main
content area. The board is meant to be a fixed-height area where each column
scrolls internally, so the whole page should not scroll vertically.

## Where
Board view, inside the `<main class="flex-1 overflow-auto bg-app">` scroll area.

## Root cause
Each board column is capped at `max-h-[calc(100vh-11rem)]`. But `<main>` sits
*below* a 48px (`h-12`) sticky topbar, so the height available to `<main>` is
`100vh - 48px - …`, not `100vh`. The `11rem` (176px) offset didn't fully account
for that topbar plus the in-`main` chrome (view tabs + toolbar + paddings), so the
columns were tall enough to push the board past `<main>`'s height, triggering
`<main>`'s own vertical scrollbar.
