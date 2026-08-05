# Bug: closing an overlay blinks/refreshes the whole page once

## Symptom

After opening a right-side panel — the new Team Workload drill-down sheet
(`TaskDrilldownSheet`), but reproducible with any Dialog/Sheet/Popover/Select —
and then closing it, the page visibly flashed once: the left sidebar (and the
rest of the layout) blinked as if the whole page had just reloaded.

It only happened intermittently and only ever once per close, which made it
look tied specifically to the click that dismissed the panel.

## Where

`components/realtime/realtime-provider.tsx` — the SSE-driven auto-refresh
client (`RealtimeProvider`). `components/ui/overlay.tsx` — the shared
focus-trap/focus-restore hooks every dismissible overlay primitive
(Dialog/Sheet/AlertDialog/Popover/DropdownMenu/Select) is built on.

## Root cause

`RealtimeProvider` defers `router.refresh()` while any overlay is open
(`isOverlayOpen()`, checked inside `shouldDefer()`) — a `data_changed` SSE
event that arrives while the user is looking at a panel is queued
(`pendingRef`) instead of yanking content out from under them. The queued
refresh is meant to flush once the user is "idle again," via three listeners:
`visibilitychange`, `window` `focus`, and `document` `focusout`.

`focusout` was meant to catch "the user blurred the input field they were
typing in." But `focusout` fires on **any** in-page focus change — including
the one every overlay triggers on its own close: `useFocusTrap` /
`useReturnFocusOnClose` (`components/ui/overlay.tsx`) synchronously call
`triggerRef.current?.focus()` in their cleanup as soon as `open` goes false,
to return focus to whatever opened the panel. That focus movement fires
`focusout` (and `focus`) on `document`/`window` in the very same tick.

So the sequence was:

1. Panel is open; `isOverlayOpen()` is true → any `data_changed` event that
   arrives is deferred, `pendingRef.current = true`.
2. User clicks "Close." `open` becomes `false`.
3. The focus trap's cleanup runs `previouslyFocusedRef.current?.focus()`
   synchronously — this fires `focusout`.
4. `RealtimeProvider`'s `focusout` listener calls `attemptFlush()`
   immediately. By now the overlay has already unregistered itself from
   `overlayLayers`, so `isOverlayOpen()` is `false` and `shouldDefer()` no
   longer blocks — the queued refresh fires right away.
5. `doRefresh()` calls `router.refresh()`, which re-renders the entire
   `[workspaceId]` layout (per `docs/realtime.md`, this is intentional — it's
   how the sidebar's list/task-count badges and List/Board views stay live).
   With no `data_changed` events pending, this step is silent; the bug only
   surfaces when at least one event arrived while the panel was open.

The net effect: closing any overlay with a deferred refresh behind it
triggered a full-layout re-render in the same frame the overlay's own exit
animation was still playing — two visual changes landing on top of each
other, which read as the sidebar "blinking" because of the close click.

## Follow-up: the blink was deterministic, not just an SSE race

Delaying the `focusout` retry (below) reduced how often the blink appeared,
but it still happened on *every* close of the task detail panel
(`/[workspaceId]/task/[taskId]`, opened by clicking any task row) — too
reliable to be explained by "a `data_changed` event happened to arrive while
the panel was open."

The actual deterministic cause is separate from `RealtimeProvider` entirely:
closing the task detail panel calls `router.push()` back to the list route
(`TaskDeepLink.handleClose`, `app/(app)/[workspaceId]/task/[taskId]/_components/task-deep-link.tsx`).
Both that route and the list route are dynamic (`app/(app)/[workspaceId]/layout.tsx`,
which renders the sidebar, calls `headers()`) and share that same layout as
their parent. Next.js 15+ changed the client Router Cache's default
`staleTime` for dynamic segments to **0 seconds** — down from 30s in earlier
versions — specifically so back/forward navigation never shows stale data.
One side effect: it also applies to *shared* layout segments, not just the
page segment that actually changed. So every navigation between these two
routes — including the one triggered by closing the panel — re-fetches and
re-renders `[workspaceId]/layout.tsx` from the server, even though nothing
in the sidebar's data changed. That server round-trip landing is what
produced the blink, deterministically, on every close.

The `next.config.mjs` `staleTimes` change below was a real fix for this
specific navigation path, but the blink kept happening after it — proof the
true cause was still elsewhere for the more general case (any Sheet/Dialog/
AlertDialog, not just the task detail panel, which is the only one that
navigates at all).

## Follow-up #2: it wasn't navigation either — it's the backdrop's exit animation

Reproducing with `TaskDrilldownSheet` (`components/workspace-overview/task-drilldown-sheet.tsx`)
— which closes via plain `setState`, no `router.push` involved at all —
still blinked on every close. That rules out both prior theories (the SSE
race and the Router Cache) as the primary cause; there had to be something
common to *closing any overlay*, full stop.

There is: `SheetOverlay` (`components/ui/sheet.tsx`) is the backdrop —
`fixed inset-0 z-50 bg-black/20`, covering the entire viewport, above the
sidebar (`z-30`). Its exit animation runs `duration-100` (100ms), but
`usePresence(open, 200)` keeps the overlay's DOM node mounted for 200ms
before removing it. Tailwind's `animate-out` utility defaults to
`animation-fill-mode: none` — nothing in `SheetOverlay`'s classes overrides
that. So the sequence on every close is:

1. t=0ms: exit animation starts, backdrop opacity animates from its resting
   value toward 0.
2. t=100ms: the animation finishes. With `animation-fill-mode: none`, the
   browser stops applying the animation's computed style and the element
   reverts to its own CSS cascade value — for `SheetOverlay` that's just
   `bg-black/20` at full opacity, since nothing else defines a separate
   "closed and settled" resting style.
3. t=100–200ms: the now fully-opaque backdrop — still covering the entire
   page, sidebar included — sits there for a full 100ms before `usePresence`
   finally unmounts it.

That 100ms full-opacity window, on a layer that covers literally everything,
is the "whole page blinking once" — deterministic on every close, unrelated
to data-fetching, SSE, or navigation. `components/ui/dialog.tsx`
(`DialogOverlay`/`DialogContent`, `duration-100` vs. `usePresence(open, 150)`)
and `components/ui/alert-dialog.tsx` (same numbers) have the identical
mismatch, just a smaller 50ms window and a less-alarming 40%-opacity-vs-20%
backdrop, so less visually loud but the same bug.

This is the same *class* of defect as item 5 in
`2026-08-03-bug-floating-overlays-fly-in-from-viewport-corner.md`
("overlays flash fully visible while closing") — its fix
(`animationFillMode: "forwards"`) was applied only to
`useFloatingPosition`'s inline `style`, which Popover/DropdownMenu/Select/
Tooltip all consume. Dialog/Sheet/AlertDialog are modal overlays with no
floating-ui positioning, so they never went through that hook and never
picked up the fix.

See `2026-08-05-solution-closing-an-overlay-flashes-the-whole-page.md`.
