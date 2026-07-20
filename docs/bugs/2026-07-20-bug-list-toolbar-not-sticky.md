# Bug: List view filter/search toolbar not sticky

**Date:** 2026-07-20
**Area:** List view — `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-view.tsx`

## Symptom
The list view's filter/search toolbar (Search, Status, Priority, Assignee, Show
archived, Sort, Group By, Create Task) and the table header scroll away with the
rows instead of staying pinned at the top.

## Where
Inside the "ClickUp-style unified workspace container" card that wraps the toolbar,
table header, and all task rows.

## Root cause
The toolbar block already had `sticky top-0`, but its wrapping card used
`overflow-hidden`. An ancestor with `overflow != visible` becomes the sticky
element's scroll container. The card isn't independently scrollable (it grows to
fit all rows and moves with the page), so the sticky toolbar had no scroll context
to stick within — it effectively behaved like `position: relative` and scrolled
away with the card. Additionally, once the List/Board/Calendar tabs were made
sticky at `top-0`, the toolbar needed to sit below them rather than collide.
