# Solution: "Save Changes" button text is unreadable in dark mode on the default accent theme

## Fix

`app/globals.css` — `.dark[data-theme="forest"]` now sets:

```css
--primary-foreground: oklch(0.99 0.002 277); /* was oklch(0.155 0.018 277) */
```

`forest` is the one accent whose dark-mode primary stays a medium-dark green
(L 0.48) instead of being boosted past ~0.6 like every other accent, so it
needs the same white-text pairing its light-mode block already uses
(`--primary-foreground: oklch(0.99 0.002 277)`), rather than the near-black
text every other dark-mode accent pairs with its much lighter primary.

## Why this works

`Button`'s `default` variant (`components/ui/button.tsx`) renders
`bg-primary text-primary-foreground` — it never hardcodes a color, it reads
whatever the active `[data-theme]` block defines. Fixing the variable fixes
every consumer (Save Changes on the Theme page's accent card and Appearance
card, and any other primary-variant button) without touching the shared
`Button` component or duplicating a color override per call site.

## Files touched

- `app/globals.css`

## Scope note

Only `forest`'s dark-mode block was changed. The other ten accents already
boost their dark-mode primary lightness enough (L ~0.62–0.94) for the shared
near-black foreground to read clearly, so they were left as-is.
