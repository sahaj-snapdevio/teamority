# Bug: floating overlays fly in from the viewport's top-left corner

## Symptom

On the daisyUI migration branch, opening any floating overlay — Popover,
DropdownMenu, Select, Tooltip — rendered it pinned to the viewport's top-left
corner instead of next to its trigger. Because the app sidebar is
`fixed inset-y-0 left-0`, the panel appeared to open *inside the sidebar*.

The symptom mutated as intermediate fixes landed, which made it look like
several unrelated bugs:

1. **Permanently pinned to the corner.** The panel never moved.
2. **Rendered at the corner, then snapped into place** once the entrance
   animation finished (~100ms).
3. **Visibly slid/"glitched" diagonally from the corner** to its real position
   on every open — worst on a fresh page load, appearing to "fix itself" after
   two or three opens.

Reproduced on `/[workspaceId]/[spaceId]/list/[listId]` (the toolbar Status /
Priority / Assignee filters, the "Select members" assignee picker) and on
`/[workspaceId]/notifications/settings` (the delivery-mode `Select`).

## Where

- `components/ui/floating.tsx` — `Portal`, `useFloatingPosition`, `usePresence`
- `components/ui/select.tsx` — `SelectContent`

All four overlay primitives share `useFloatingPosition`, so a defect there
surfaced everywhere at once.

## Root cause

Four independent defects, all introduced while replacing radix-ui's
Popper-based positioning with `@floating-ui/dom`, stacked on the same symptom.

### 1. The position was never computed (permanent corner pin)

`useFloatingPosition` registered `autoUpdate` in an effect guarded by
`if (!open || !reference || !floating) return`, with `floatingRef` a plain
`useRef`. `Portal` has its *own* client-mount gate that returns `null` on its
first render, so on the render where the overlay opens, the portaled `<div>`
does not exist yet and `floatingRef.current` is still `null` — the effect
bailed out.

`Portal` mounted its child a tick later and the ref callback populated
`floatingRef.current`, but a ref mutation triggers no re-render, and the
effect's deps (`[open, update]`) never changed again. `computePosition` was
therefore never called for the entire open session, leaving `styles` at its
initial fallback of `{ position: "fixed", top: 0, left: 0 }` — literally the
viewport corner.

### 2. Positioning fought the entrance animation for `transform`

Once positioning worked, it applied `transform: translate(x, y)`. The entrance
classes (`data-open:animate-in`, `zoom-in-95`, `slide-in-from-*`) animate
`transform` too, and the animation wins for its duration — so the element
rendered un-translated (at the corner) until the animation finished, then
snapped into place.

### 3. A global `transition: all` animated `top`/`left` (the visible slide)

After switching to `top`/`left`, the measured computed style showed
`transition-property: all; transition-duration: 0.1s` applying to the floating
element. The browser therefore **transitioned** `top`/`left` from the `0,0`
fallback to the real coordinates, sliding the panel across the screen. Measured
on a cold load, first open:

| time | rendered position | inline style |
|---|---|---|
| t+80ms | (3, 3) | `top: 337px; left: 561px` |
| t+108ms | (323, 194) | `top: 337px; left: 561px` |
| t+153ms | (518, 311) | `top: 337px; left: 561px` |
| t+214ms | (561, 337) | `top: 337px; left: 561px` |

The inline style is correct the whole time — only the *rendered* position lags,
which is what made this look like a positioning bug rather than a transition.
This also explains "it works after 2-3 clicks": on reopen the coordinates are
already correct, so there is nothing to transition from.

### 4. `SelectContent` bypassed the not-yet-positioned guard

`useFloatingPosition` reports `visibility: hidden` until it has a real computed
position. `SelectContent` spread `...styles` but then unconditionally
overwrote it with `visibility: visible ? "visible" : "hidden"`, defeating that
guard. This mattered only for `Select`: unlike Popover/DropdownMenu, which
mount fresh on each open, `SelectContent` stays mounted while closed, so it can
reach a render where it is visible but not yet positioned.

## Follow-up: "Project settings" submenu appeared to do nothing

Once positioning was correct, one more symptom surfaced in the sidebar account
menu (`components/workspace/workspace-shell.tsx`): clicking **Project settings**
— which swaps the menu's contents in-place for a project picker — looked like a
no-op.

The click was never the problem. Instrumented, the picker *does* render, then
reverts ~120ms later:

| time | popover box | picker shown? |
|---|---|---|
| before click | y=410, h=254 | — |
| t+30ms | y=535, h=129 | yes |
| t+60ms | y=535, h=129 | yes |
| t+120ms | y=416 | no — reverted |

The menu is `side="top"`, so it is **bottom-anchored**: its bottom edge stays
at `trigger.top - gap` (664px in both states). The picker's content is shorter,
so the panel shrinks and its *top* edge drops from 410 to 535 — out from under
a cursor resting on the "Project settings" row at y≈519. That fires a spurious
`mouseleave`, which schedules the 180ms hover-close whose callback runs
`setShowProjectPicker(false)`, undoing the click. The menu itself stayed open
because the pointer re-entered it, so the net effect was "the button does
nothing".

This is a hover-intent/layout-shift interaction, independent of the four
positioning defects above, but it was masked by them until they were fixed.

## Follow-up: overlays flash fully visible while closing

Closing any dropdown showed a brief flash that read as "it re-opens, then
closes". Sampled per animation frame on the close:

| time | opacity | |
|---|---|---|
| t+7 → t+89ms | 1 → 0.02 | exit animation fading out |
| **t+106ms** | **1** | **snaps back to fully visible** |
| t+172ms | — | node removed |

The exit animation (`data-closed:animate-out`, `duration-100`) runs for 100ms,
but `usePresence` keeps the node mounted for 150ms. The animation's default
`animation-fill-mode: none` means that the instant it finishes, the element
reverts to its underlying styles — fully opaque — for the remaining ~50-65ms
before unmount. Hence a full-opacity flash at the very end of the close.

## Notes

A related latent issue was found but deliberately **not** changed, as it is not
causing a symptom in the current layout: `components/ui/dialog.tsx`'s
`DialogPortal` is a plain `<>{children}</>` rather than a real `createPortal`.
No ancestor between the modal and `<body>` currently sets
`transform`/`filter`/`perspective`, so `position: fixed` still resolves against
the viewport.

See `2026-08-03-solution-floating-overlays-fly-in-from-viewport-corner.md`.
