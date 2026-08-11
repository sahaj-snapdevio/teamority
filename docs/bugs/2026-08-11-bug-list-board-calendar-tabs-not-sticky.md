# Bug: Board/List/Calendar tabs row not sticky

**Date:** 2026-08-11
**Area:** `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-container.tsx`

## Symptom

On the List/Board/Calendar page, the per-view filter/search toolbar (`sticky
top-14`, inside `list-view.tsx`/`calendar-view.tsx`) correctly stayed pinned
while scrolling, but the Board/List/Calendar tabs row above it (`sticky
top-0`) scrolled away with the page almost immediately instead of remaining
pinned at the top.

## Where

`list-container.tsx` — the `<div className="-mx-3 -mt-3 sm:-mx-6 sm:-mt-6">`
wrapper around the `sticky top-0` tabs bar.

## Root cause

A `position: sticky` element only remains stuck while its containing block
(effectively its immediate block-level parent) is scrolling through the
sticky offset — it can't stick past the point where that parent's box ends.

The tabs bar's wrapper div contained *only* the tabs bar itself — no other
content — so the wrapper's height exactly equaled the sticky child's height.
That gave the sticky element zero scroll range: it stopped being able to
stick almost immediately after the first few pixels of scroll and then
scrolled away with the rest of the page like a normal statically-positioned
element.

The filter/search toolbar below it didn't have this problem because its own
containing block (per `2026-07-20-solution-list-toolbar-not-sticky.md`) spans
the full, tall list of rows — plenty of room for the sticky calculation.

See `2026-08-11-solution-list-board-calendar-tabs-not-sticky.md`.
