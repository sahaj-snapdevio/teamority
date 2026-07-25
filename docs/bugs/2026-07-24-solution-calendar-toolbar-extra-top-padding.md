# Solution — Drop the Calendar toolbar's redundant top padding

**Date:** 2026-07-24
**Item:** #11

## What changed

`calendar-view.tsx`, the toolbar container inside the sticky header block:

```diff
-className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 shrink-0"
+className="flex flex-wrap items-center gap-2 border-b border-border px-4 pb-2 shrink-0"
```

`py-2` → `pb-2`. The bottom padding stays — it's what separates the controls from the toolbar's `border-b` and the weekday row underneath.

A comment above the element records why there's no `pt-*`, so it doesn't get "fixed" back later.

## Files touched

- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/calendar-view.tsx`

## Why it works

`ListContainer`'s `space-y-5` supplies the gap between the view tabs and whatever view is mounted, identically for List, Board and Calendar. Removing the toolbar's own top padding leaves exactly one source of that gap, so Calendar's first control now lines up with Board's at 20px below the tab row.

Nothing overlaps once scrolled: the month grid scrolls under the **weekday** row, which is the bottom of the same `sticky top-14` block, not under the toolbar — so the toolbar pinning flush against the tab bar's bottom border is the intended resting position, not a collision. Horizontal padding (`px-4`) is untouched.
