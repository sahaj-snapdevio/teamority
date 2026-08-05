# Solution: closing an overlay blinks/refreshes the whole page once

Fixes the defect described in
`2026-08-05-bug-closing-an-overlay-flashes-the-whole-page.md`.

## Files touched

- `components/realtime/realtime-provider.tsx`
- `next.config.mjs`
- `components/ui/sheet.tsx`
- `components/ui/dialog.tsx`
- `components/ui/alert-dialog.tsx`

## Change

The "user became idle, retry the deferred refresh" effect used one handler
(`onMaybeIdle`) for all three listeners. Split it: `visibilitychange` and
`window` `focus` (genuine tab-switch signals, where an immediate refresh on
return is expected) keep calling `attemptFlush()` synchronously. `document`
`focusout` now goes through a 400ms settle timer
(`setTimeout(attemptFlush, 400)`, re-armed on every `focusout`) before
calling `attemptFlush()`.

This doesn't skip the refresh — a genuinely pending change still lands. It
just stops it from firing in the exact same tick as an overlay's own
close-focus-restore, so by the time it runs, the overlay's ~150-200ms exit
animation (`usePresence`) has already finished. The refresh and the panel's
own closing animation no longer visually overlap, so a full-layout
re-render (when one was actually queued) reads as an ordinary background
update instead of something the close click caused.

The 400ms delay only affects this one retry path — the original debounce
(`DEBOUNCE_MS = 600`) that coalesces a burst of `data_changed` events when
they first arrive, and the immediate `visibilitychange`/`focus` retries, are
unchanged.

## Follow-up: the deterministic blink (`next.config.mjs`)

The `RealtimeProvider` fix above only addressed a probabilistic race. The
blink that happened on *every* close of the task detail panel came from
Next.js 15+'s default client Router Cache `staleTime` of 0s for dynamic
routes, which causes even an unchanged *shared* layout segment
(`app/(app)/[workspaceId]/layout.tsx`, which renders the sidebar) to be
re-fetched and re-rendered on every navigation between two dynamic routes —
including the `router.push()` that closing the task panel does to return to
the list.

Added:

```js
experimental: {
  staleTimes: {
    dynamic: 30,
  },
},
```

This restores the pre-Next-15 default (30 seconds) for how long the client
Router Cache treats a dynamic segment's already-rendered output as reusable.
Navigating between two routes that share a dynamic layout — opening a task
and closing it back to the list, for example — now reuses the sidebar's
existing render instead of re-fetching it, as long as it's within that 30s
window. This is a global setting (it affects the whole app's dynamic-route
navigations, not just the task panel), but it only widens *reuse* of
already-fetched data; it never serves data staler than an explicit
`router.refresh()` would override, since an explicit refresh always bypasses
this cache regardless of `staleTime`. `docs/realtime.md`'s live-update path
(SSE → `router.refresh()`) is therefore unaffected.

## Follow-up #2: the actual cause — backdrop exit animation fill-mode

Neither fix above stopped the blink, because neither was the primary cause —
it reproduces on `TaskDrilldownSheet` too, which involves no navigation and
no SSE at all. The real cause: `SheetOverlay` (`components/ui/sheet.tsx`) —
the full-viewport `fixed inset-0 z-50 bg-black/20` backdrop — animates its
fade-out over `duration-100` (100ms), but stays mounted for
`usePresence(open, 200)` (200ms). Tailwind's `animate-out` defaults to
`animation-fill-mode: none`, so once the 100ms animation finishes, the
backdrop reverts to its base fully-opaque style for the remaining 100ms
before unmount — a full-page dark flash on the layer that sits above
everything, including the sidebar.

Added the `fill-mode-forwards` utility class (`animation-fill-mode:
forwards`, defined by `tw-animate-css`) so the element holds its exit
animation's final frame (opacity 0) instead of reverting:

- `components/ui/sheet.tsx` — `SheetOverlay` (`duration-100` vs.
  `usePresence(open, 200)`, a 100ms gap). `SheetContent` itself already
  matches its 200ms presence duration, so it didn't need the class.
- `components/ui/dialog.tsx` — both `DialogOverlay` and `DialogContent`
  (`duration-100` vs. `usePresence(open, 150)`, a 50ms gap each).
- `components/ui/alert-dialog.tsx` — same as Dialog, both Overlay and
  Content.

This is the same defect `useFloatingPosition` (`components/ui/floating.tsx`)
already works around for Popover/DropdownMenu/Select/Tooltip via an inline
`animationFillMode: "forwards"` style (see
`2026-08-03-solution-floating-overlays-fly-in-from-viewport-corner.md`,
"overlays flash fully visible while closing") — Dialog/Sheet/AlertDialog
don't go through that hook (they're modal, not floating-ui positioned), so
they'd never picked up the fix.
