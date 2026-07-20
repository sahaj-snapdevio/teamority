# Solution: Make the list toolbar sticky under the tabs

**Date:** 2026-07-20
**Bug:** [2026-07-20-bug-list-toolbar-not-sticky.md](./2026-07-20-bug-list-toolbar-not-sticky.md)

## Fix
Two className changes in `list-view.tsx` (the workspace-container card):
1. Card `overflow-hidden` → `overflow-clip`. `overflow-clip` still clips the
   `rounded-2xl` corners but does **not** establish a scroll container, so the
   sticky toolbar inside references the real scroller (`<main>`).
2. Toolbar wrapper `sticky top-0` → `sticky top-14` so it pins just below the
   sticky List/Board/Calendar tabs (~3.5rem tall) instead of colliding with them.

## Files touched
- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-view.tsx`
  — two classNames on the card + sticky header wrapper.

## Why it works
With the card no longer a scroll container, the toolbar's nearest scrolling
ancestor is `<main>`, so `position: sticky` engages against the page scroll. The
`top-14` offset seats it right under the sticky view tabs; the toolbar keeps its
`bg-card` so rows scroll cleanly beneath it. The table header, being in the same
sticky block, stays pinned too. No logic or data changes.
