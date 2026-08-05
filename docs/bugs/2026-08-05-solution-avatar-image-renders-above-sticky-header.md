# Solution: assignee avatar image renders above the sticky list header on scroll

## Fix

`components/ui/avatar.tsx` — added `relative isolate` to the `Avatar` root
`span`'s className:

```diff
- "avatar group/avatar flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 ..."
+ "avatar group/avatar relative isolate flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 ..."
```

- `relative` makes `Avatar` the containing block for its absolutely
  positioned children (`AvatarImage`, `AvatarFallback`, `AvatarBadge`), so
  they size and position against the small avatar box itself rather than
  whatever ancestor happened to be positioned.
- `isolate` (`isolation: isolate`) makes `Avatar` establish its own stacking
  context, so `AvatarImage`'s `z-10` and `AvatarBadge`'s `z-20` are only ever
  compared against each other *inside* the avatar — they can no longer leak
  out and compete with unrelated `z-index` values elsewhere on the page (the
  List view's sticky toolbar, dropdowns, modals, etc.).

## Why this instead of bumping the header's z-index

Raising the sticky toolbar's `z-10` would only patch this one screen. The
underlying defect — `Avatar`'s internal `z-10`/`z-20` values not being scoped
to the component — could resurface anywhere else an `Avatar` sits inside a
scrolling list under any other sticky/fixed/positioned element. Fixing the
shared primitive in `components/ui/avatar.tsx` fixes it everywhere `Avatar`
is used in one change, per the project's "reuse/extract shared components"
convention.

## Files touched

- `components/ui/avatar.tsx`

## Verification

- Reasoned through the CSS stacking-context rules for `position` +
  `isolation` (no dev server available in this session to visually confirm
  in-browser).
