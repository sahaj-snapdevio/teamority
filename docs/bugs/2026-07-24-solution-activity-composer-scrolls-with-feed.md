# Solution — Activity composer pinned to the bottom of the panel

**Date:** 2026-07-24
**Item:** #1
**Bug doc:** `2026-07-24-bug-activity-composer-scrolls-with-feed.md`

## What changed

`TaskActivityFeed` gained two props and now renders one of two layouts instead of a single flat stack. The feed's contents (`header` / `body` / `composer`) are built once and placed into whichever layout the surface asks for, so there is no duplicated markup.

| Prop | Default | Meaning |
|---|---|---|
| `variant` | `"inline"` | `"fill"` — the feed owns its parent's full height: the activity list is the scroll container and the composer is a flex footer. `"inline"` — the feed is one section inside a taller scroll column, so the composer sticks to the bottom of that scrollport. |
| `hideHeader` | `false` | Suppresses the built-in "Activity" label when a parent header already supplies one. Mirrors the existing `hideHeader` on `TaskTimeTracking`. |

### `variant="fill"` (full task page)

```tsx
<div className="flex h-full min-h-0 flex-col">
  <div className="flex-1 min-h-0 overflow-y-auto space-y-3 px-5 py-4">{header}{body}</div>
  <div className="shrink-0 border-t bg-background px-5 py-3">{composer}</div>
</div>
```

### `variant="inline"` (drawer)

```tsx
<div className="space-y-3">
  {header}{body}
  <div className="sticky bottom-0 z-10 -mx-6 border-t bg-background px-6 pb-4 pt-3">{composer}</div>
</div>
```

### Files touched

| File | Change |
|---|---|
| `components/task/task-activity-feed.tsx` | Added `variant` + `hideHeader` props; split the render into `header` / `body` / `composer` locals and the two layouts above. |
| `app/(app)/[workspaceId]/task/[taskId]/_components/task-detail-page.tsx` | Right column wrapper `flex-1 overflow-y-auto px-5 py-4` → `flex-1 min-h-0` (it no longer scrolls — the feed does), and the feed is mounted with `variant="fill" hideHeader`. |
| `components/task/task-detail-panel.tsx` | Untouched — it takes the `"inline"` default. |

## Why it works

**Full page.** The scrollport moved down one level, from the column wrapper into the feed. The feed is now a flex column filling that wrapper: the list gets `flex-1 min-h-0 overflow-y-auto` and the composer `shrink-0`. `min-h-0` on both the wrapper and the list is the load-bearing part — a flex item's default `min-height: auto` refuses to shrink below its content, so without it the list would grow to its full content height and push the composer out of view instead of scrolling. The `px-5 py-4` padding moved onto the scroll region so the visual result is unchanged, and the composer footer gets its own `px-5 py-3 border-t`.

`hideHeader` is passed because the page already renders an "Activity" bar above the column; without it the word appeared twice once the internal label stopped scrolling away.

**Drawer.** The feed genuinely cannot own the height here — it shares a column with description, checklists, time tracking and dependencies. `position: sticky` solves it without restructuring that column: the composer sits in normal flow, and while any part of the activity section is in the scrollport the composer is held against its bottom edge. The `-mx-6 px-6` bleed cancels the column's `px-6` padding so the composer's `bg-background` covers the full width when stuck, rather than leaving feed items visible in the gutters behind it.

## Verification notes

- Sticky needs no `overflow: hidden` on any ancestor between the composer and the scroll column; the drawer's chain (`SheetContent` → main column) satisfies this.
- The composer's own state is local Tiptap editor state and was not moved, so a half-typed comment survives the layout change and the feed's realtime refetch exactly as before.
