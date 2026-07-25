# Bug — Calendar view has extra padding above its toolbar

**Date:** 2026-07-24
**Item:** #11

## Symptom

Switching from List or Board to Calendar makes the content visibly drop. The Calendar's search box sits lower than the List/Board search boxes did, so the tab row appears to "grow" a gap when Calendar is selected, and the month grid loses a row's worth of height on short viewports.

## Where

`app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/calendar-view.tsx` — the toolbar `<div>` inside the sticky header block, above the weekday row.

## Root cause

Two top gaps stacked.

`ListContainer` (`list-container.tsx`) renders the active view inside `<div className="space-y-5 p-6">`, so **every** view already gets a 20px gap between the sticky List/Board/Calendar tabs and its own first element. `board-view.tsx`'s toolbar relies on exactly that and adds no top padding of its own (`… flex-wrap mb-3`).

The Calendar toolbar declared `px-4 py-2`. The `py-2` added another 8px on top of the container's 20px, so Calendar started 28px below the tabs where Board started at 20px.

It only reads as "extra padding" rather than "wrong padding" because the toolbar is inside a `sticky top-14` wrapper — when the page is scrolled the container's `space-y-5` margin scrolls away and only the stray `py-2` remains, which is why the gap looks inconsistent depending on scroll position.
