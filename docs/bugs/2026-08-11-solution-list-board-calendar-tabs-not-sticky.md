# Solution: Board/List/Calendar tabs row not sticky

**Date:** 2026-08-11
**Area:** `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-container.tsx`

## Fix

Moved the active view (`BoardSkeleton` / `ListView` / `BoardView` /
`CalendarView`) from being a sibling of the tabs bar's `-mx-3 -mt-3 sm:-mx-6
sm:-mt-6` wrapper to being nested *inside* it. That gives the wrapper (the
tabs bar's containing block) real height — spanning the tabs bar plus the
full view content — so the sticky calculation has scroll range to work with
and the tabs bar now stays pinned for the whole scroll, not just the first
few pixels.

The negative margin still lives on the wrapper, not on the sticky element
itself (preserves the phantom-scrollbar fix from
`2026-08-10-solution-sticky-toolbar-bleed-through.md`). The nested content
gets its own `px-3 pt-5 sm:px-6` to restore the horizontal inset and the
gap the wrapper's `-mx`/removal from `space-y-5` used to provide; the bottom
inset still comes from the outer `p-3`/`sm:p-6`, since the wrapper doesn't
cancel its own bottom margin.

Once the tabs bar stayed correctly stuck for the whole scroll (rather than
unsticking after a few px), a follow-up gap became visible: Calendar view's
own sticky toolbar (`top-14`, in `calendar-view.tsx`) had no top padding, so
once both bars were pinned during scroll they sat flush/touching. List
view's sticky toolbar already carried a `pt-5` for exactly this breathing
room in the stuck state; Calendar's toolbar was missing the equivalent.
Added `pt-5` to Calendar's sticky toolbar row, matching List view.

## Files touched

- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-container.tsx`
- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/calendar-view.tsx`

## Why it works

`position: sticky` only remains stuck while its containing block is
scrolling through the sticky offset. Giving the tabs bar's containing block
the same height as the scrollable list content (instead of just its own
56px) means it now has scroll range for the whole page, matching how the
filter/search toolbar below it was already fixed to behave in
`2026-07-20-solution-list-toolbar-not-sticky.md`.
