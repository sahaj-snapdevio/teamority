# Solution: floating overlays fly in from the viewport's top-left corner

Fixes the four defects described in
`2026-08-03-bug-floating-overlays-fly-in-from-viewport-corner.md`. All changes
are in the shared overlay layer, so Popover, DropdownMenu, Select and Tooltip
are fixed together.

## Files touched

- `components/ui/floating.tsx`
- `components/ui/select.tsx`

## Changes

### 1. Re-trigger positioning when the portaled node attaches

`useFloatingPosition`'s `floatingRef` is now a `useMemo`'d object with a
getter/setter `current` property instead of a plain `useRef`. Assigning a node
bumps a `floatingVersion` state counter, which is in the `autoUpdate` effect's
dependency array — so when `Portal` mounts its child a tick after open, the
effect re-runs and actually calls `computePosition`.

Two details that matter:

- The ref object has a **stable identity** (empty `useMemo` deps), so `update`'s
  closure over it stays valid.
- The setter only bumps when the node is non-null **and** differs from the last
  node it notified about (`lastNotifiedNodeRef`). Consumers pass an inline
  `ref={(node) => ...}` callback whose identity changes every render; React
  responds by calling the old ref with `null` and the new one with the node on
  *every* render. Bumping on each non-equal write (including those transient
  nulls) caused re-render → ref churn → re-render, producing a
  "Maximum update depth exceeded" crash. Ignoring nulls and de-duplicating
  against the last notified node fixes it.

### 2. Position with `top`/`left`, not `transform`

`computePosition`'s result is applied as `top`/`left` so it no longer competes
with the entrance animation, which owns `transform` for its zoom/slide.

### 3. Suppress the incidental `transition: all`

The computed style carries a global `transition-property: all` with a 0.1s
duration, which made the browser animate `top`/`left` from the `0,0` fallback —
the visible slide-in from the corner. Both the initial fallback style and every
computed result now include `transitionProperty: "none"`.

This does **not** affect the intended entrance effect: the zoom/fade is a CSS
*animation* (`animation-name: enter`, from `data-open:animate-in`), which
transitions have no bearing on. Verified by computed style after the fix —
`animation-name: enter` is still applied.

### 4. Run the mount chain before paint

`Portal`'s mount gate and `usePresence`'s entry transition moved from
`useEffect` to `useLayoutEffect`, and the `autoUpdate` effect now calls
`update()` eagerly rather than waiting for `autoUpdate`'s internal
`ResizeObserver` to fire on a later tick. Previously each step let the browser
paint an intermediate frame, which read as a blink on open. `useLayoutEffect`
is already an established pattern here (`accordion.tsx`,
`slash-command-menu.tsx`).

### 5. `SelectContent` respects the not-yet-positioned guard

`components/ui/select.tsx` now ANDs with the hook's value
(`visible && styles.visibility !== "hidden"`) instead of overwriting it, and
uses the shared `usePresence` hook rather than a local `useState` +
`useEffect` + `setTimeout` reimplementation.

### 6. "Project settings" submenu no longer closes itself

`components/workspace/workspace-shell.tsx`:

- `scheduleCloseProfileMenu()` returns early while `showProjectPicker` is true,
  so the layout-shift-induced `mouseleave` can't schedule the close that reset
  the picker. The picker is entered by an explicit click, so it now stays up
  until explicitly dismissed — Back, choosing a project, Escape, or a click
  outside (all still handled by `useDismiss`).
- The button's `onClick` also calls `openProfileMenu()` before setting the
  picker, cancelling any close already scheduled by a `mouseleave` in flight —
  otherwise that timer still fires and resets the picker.

Hover-close behaviour is unchanged for the normal account menu.

### 7. Exit animation holds its end state

`useFloatingPosition`'s styles now include `animationFillMode: "forwards"`, so
the exit animation holds `opacity: 0` until `usePresence` unmounts the node
instead of reverting to fully-opaque as soon as it finishes. Applied in the
shared hook, so Popover, DropdownMenu, Select and Tooltip are all covered.

`forwards` is safe for the enter animation too: the `enter` keyframes define
only a `from` block, so its implicit end state is the element's normal styling
— holding that is a no-op.

Note this does **not** cover Dialog/Sheet/AlertDialog, which have their own
presence handling and don't go through `useFloatingPosition`. They use the same
`data-closed:animate-out` + `duration-*` pairing, so they are likely to have the
same latent flash; not changed here because no symptom was reported and the fix
belongs with whatever presence logic those use.

## Why it works

The corner position was only ever the *fallback* style used before a real
position exists. The fixes make that fallback unreachable in practice
(positioning now runs on the first open, before paint) and unobservable when it
does occur (hidden until positioned, and never transitioned from).

## Verification

Driven with Playwright against the dev server on a cold load, sampling the
overlay's bounding box on first open — before vs. after:

| time | before | after |
|---|---|---|
| t+~84ms | (3, 3) — corner | (564, 340) — in place |
| t+~110ms | (323, 194) | (561, 337) |
| t+~155ms | (518, 311) | (561, 337) |
| settled | (561, 337) | (561, 337) |

The residual ~3px offset at t+84ms after the fix is `zoom-in-95` scaling — the
entrance animation working as intended. Popover paths were sampled the same way
and are stable at the correct coordinates from the first sample.

The "Project settings" picker was verified the same way — it now stays open
through t+300ms and past the `mouseleave` that previously collapsed it, where
before it reverted at t+120ms.

Close, sampled per frame: opacity now runs `1 → 0.78 → 0.42 → 0.2 → 0.08 →
0.02 → 0` and **stays** at 0 until removal, where before it snapped back to 1
at t+106ms.

Open, sampled per frame: `t+19ms opacity=0 visibility=hidden y=-2` (the
un-positioned frame, correctly hidden by the guard), then `t+23ms
visibility=visible y=193` — already at its final position — fading 0 → 1 over
~100ms. Confirms the not-yet-positioned frame is never shown and the entrance
animation is intact.

`tsc --noEmit` is clean.
