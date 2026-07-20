# Solution: Taller global search palette

**Date:** 2026-07-20
**Bug:** [2026-07-20-bug-search-palette-results-too-short.md](./2026-07-20-bug-search-palette-results-too-short.md)

## Fix
Made the palette panel height conditional in `components/search/search-palette.tsx`
(the panel `<div>`): grow to `h-[min(600px,85vh)]` **only when there are results**
(`hasResults`), otherwise keep the compact default `h-[min(440px,85vh)]`. A
`transition-[height]` eases between the two.

## Files touched
- `components/search/search-palette.tsx` — panel container className switched to a
  `cn(...)` conditional on `hasResults`.

## Why it works
The panel is a flex column: input/filter header (fixed) + results (`flex-1
overflow-y-auto`) + footer (fixed). When results exist, the taller panel hands the
extra space to the `flex-1` results area, so ~4–5+ rows are visible before
scrolling. When the palette is empty (no query / no matches), it stays at the
original compact size so it isn't oversized. The `min(..., 85vh)` cap keeps it
responsive on short screens; results still scroll for longer lists. No logic, data,
or query changes.
