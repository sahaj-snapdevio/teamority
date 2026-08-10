# Solution: DropdownMenu causes the page to jump/scroll on open

Fixes the defect described in
`2026-08-10-bug-dropdownmenu-scroll-jump.md`.

## Files touched

- `components/ui/dropdown-menu.tsx`

## Change

Added `{ preventScroll: true }` to the one `.focus()` call responsible for
the jump — the auto-focus-first-item-on-open effect:

```tsx
firstItem?.focus({ preventScroll: true })
```

`preventScroll` only suppresses the browser's auto-scroll side effect of
`.focus()`; the element still receives focus identically, so `aria-*`
semantics, Escape/outside-click dismissal, submenu behavior, and
positioning are all unaffected.

Deliberately left untouched: the four arrow-key/Home/End `.focus()` calls
in the same file's `onKeyDown` handler, and the submenu's ArrowLeft
return-focus call. Those move focus *within* the menu's own
`overflow-y-auto` list as the user navigates a long menu, where the
browser's native scroll-into-view is the desired behavior (it's what
reveals off-screen menu items inside the menu's own scroll container).
Adding `preventScroll` there would regress keyboard navigation on long
menus, so the fix is scoped to only the open-effect call that caused the
reported page-level jump.

`components/ui/select.tsx` and `components/ui/popover.tsx` have an
analogous unguarded `.focus()`-on-open call (`select.tsx:223`,
`popover.tsx:161`) that could exhibit the same class of bug, but were out
of scope for this fix and were not touched.
