# Bug: DropdownMenu causes the page to jump/scroll on open

## Symptom

On a tall page where a dropdown's trigger sits far from the top or bottom
of the viewport, opening the dropdown could cause the whole page to
visibly jump/scroll, even though the menu panel itself was already
correctly positioned on-screen.

## Where

`components/ui/dropdown-menu.tsx` — `DropdownMenuContent`'s auto-focus-
first-item-on-open effect. Flagged during the daisyUI migration follow-up
audit (`docs/internal/2026-08-07-daisyui-migration-report.md`) as a
pre-existing, out-of-scope bug found in Phase 0.

## Root cause

```tsx
React.useEffect(() => {
  if (!open) return
  const firstItem = focusableMenuItems(contentRef.current as HTMLElement)[0]
  firstItem?.focus()
}, [open, contentRef])
```

This passive effect runs after Floating UI has already positioned and
painted the menu panel — `useFloatingPosition` (`components/ui/floating.tsx`)
applies `position: fixed` plus explicit pixel `top`/`left` via a synchronous
`useLayoutEffect`, so the panel is on-screen by the time this effect fires.

`firstItem?.focus()` called the DOM's default `.focus()` with no options.
The browser's default focus behavior scrolls the newly-focused element's
scrollable ancestors — including the page itself — into view whenever it
judges the element to be out of view relative to any ancestor. That check
is spurious here, since the panel is already visible via `position: fixed`;
on a tall page it manifested as a visible page jump the instant the menu
opened.

Confirmed local to this one file, not the shared `components/ui/overlay.tsx`
engine: `DropdownMenu` only calls `useReturnFocusOnClose` from `overlay.tsx`
(fires on close, restoring focus to the already-on-screen trigger — not
implicated), and `useFocusTrap` (the other focus-moving hook in
`overlay.tsx`) is dead code, not invoked by any component in the codebase.
No `.focus()` call anywhere in either file passed `{ preventScroll: true }`.

See `2026-08-10-solution-dropdownmenu-scroll-jump.md`.
