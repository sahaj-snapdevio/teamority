# Bug: "Save Changes" button text is unreadable in dark mode on the default accent theme

## Symptom

On the Theme page (`/[workspaceId]/theme`) and anywhere else a `default`-variant
`Button` is used, switching to dark mode made the button's label essentially
invisible — the "SAVE CHANGES" caption blended into its own background,
regardless of whether the button was enabled or in its dimmed disabled state.

Reported on the workspace accent color card and the Appearance card, both of
which render a `Button` with `variant="default"` in their action bar.

## Where

- `app/globals.css` — `.dark[data-theme="forest"]`

## Root cause

Every workspace in this environment is on the default `forest` accent theme
(`workspace.theme` defaults to `'forest'`).

`Button`'s `default` variant renders `bg-primary text-primary-foreground`. In
dark mode, every accent's `--primary` is boosted well past mid-lightness so
that the existing dark `--primary-foreground` (`oklch(0.155 0.018 277)`, near
black) reads clearly on top of it — e.g. indigo goes from L 0.513 (light mode)
to L 0.654 (dark mode), blue 0.56 → 0.66, orange 0.62 → 0.72.

`forest` was the outlier: its dark-mode `--primary` is only
`oklch(0.48 0.09 163)` (L 0.48) — barely above the light-mode value (0.38) and
nowhere near the ~0.6+ lightness the other accents reach. It was still paired
with the same near-black `--primary-foreground` as every other accent, so a
medium-dark green background ended up with near-black text on it — too little
contrast to read, and effectively invisible once the button's own
`disabled:opacity-50` (compounded with the form's `opacity-60` wrapper while
there are no unsaved changes) dimmed it further toward the near-black page
background.

See `2026-08-05-solution-save-changes-button-invisible-in-forest-dark-theme.md`.
