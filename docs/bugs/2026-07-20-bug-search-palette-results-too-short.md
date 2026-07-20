# Bug: Global search palette shows too few results

**Date:** 2026-07-20
**Area:** Global search / command palette — `components/search/search-palette.tsx`

## Symptom
When the global search palette has results (e.g. `TASKS (25)`), only ~2–3 rows are
visible at once, forcing a lot of scrolling to scan matches. Users expect to see
roughly 4–5 result rows without scrolling.

## Where
The search palette modal opened via the topbar search (⌘K).

## Root cause
The palette panel had a fixed height of `h-[min(440px,85vh)]`. After the header
(66px), the filter bar, the active-filter chips row, and the footer hint bar, the
`flex-1` results area was left with only enough room for ~2.5 rows. The results
list itself scrolls fine (`overflow-y-auto`); the panel was simply too short.
