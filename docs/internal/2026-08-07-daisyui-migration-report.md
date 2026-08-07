# daisyUI Migration — Report

**Date:** 2026-08-07
**Branch:** `feat/daisyui-migration`
**Plan:** `.claude/plans/i-need-complete-migration-refactored-kite.md`

## Summary

Migrated Kanbanica's styling from a shadcn-style custom token layer (bridged
onto daisyUI underneath) to daisyUI-native tokens as the source of truth,
across the entire app — `app/globals.css`, all 34 `components/ui/`
primitives, and ~180 feature-code files. Net diff: **172 files changed, 2120
insertions / 2121 deletions** — a near-perfectly line-neutral rename, as
intended for a token migration that isn't supposed to touch behavior.

## What changed, by phase

| Phase | Scope | Outcome |
|---|---|---|
| 0 | Pre-flight: kitchen-sink QA route, 22-theme baseline capture | Found 2 pre-existing bugs (see below), unrelated to this work |
| 1 | Token bridge inversion in `app/globals.css` | `--color-base-100/200/300/content`, `primary`, `neutral`, `info/success/warning/error` (+ `-content`) now authored directly; old shadcn names kept as aliases. Bundled 3 real bugfixes (below). `--accent`/`--secondary` deliberately deferred — real code still read them |
| 2 | Leaf primitives (button, card, badge, alert, input, textarea, search-input, separator, progress, avatar) | Token-only; `skeleton`/`spinner` needed no changes (already pure daisyUI); `label.tsx` needed no changes (no color tokens, and daisyUI's `.label` is a different structural pattern) |
| 3 | Form controls (switch, checkbox, radio-group, table) | Token-only — switch/checkbox/radio-group kept their custom `<button role>`/hidden-input markup (not real `<input>`-driven, so daisyUI's `:checked`-based classes don't apply); table adopted `table`/`table-zebra` (native markup, safe fit) |
| 4 | Overlay family (tabs, accordion, tooltip, dropdown-menu, select, popover, dialog, sheet, alert-dialog) | Token-only everywhere except `tabs.tsx` (already used `tabs`/`tab`). `floating.tsx`/`overlay.tsx`/`overlay-stack.ts` — the portal/focus-trap/dismiss-stack engine — verified **zero diff**, confirmed via `git diff --stat` |
| 5a | Mechanical feature-code sweep (~160 files, `app/`+`components/` outside `ui/`) | Regex-based rename, boundary-anchored, prefix-agnostic (caught `bg-muted-foreground`, `border-popover` etc. that a naive fixed-prefix-list sweep missed on the first pass) |
| 5b | `accent` token resolution | Individually reviewed every one of the ~400 `bg-accent`/`text-accent-foreground` call sites (not blanket-applied). Every site converged on neutral-highlight semantics — active tabs, current-page nav, selection chips, drag-over targets, icon backdrops all reused the identical class as their own hover state. No genuine "brand emphasis" usage found anywhere. Retired `--accent`/`--accent-foreground` from `:root`/`.dark`/all 22 theme blocks/`.force-light`; `--color-accent` now aliases `primary` (daisyUI requires the role to exist) |
| 6 | Shim removal, `lint:tokens` gate, docs | Legacy `@theme inline` aliases deleted (one exception: `--foreground`, still read by `button.tsx`'s deferred-secondary `color-mix()`). `@layer base` repointed. Fixed 3 files (`form.tsx`/`combobox.tsx`/`calendar.tsx`) that were architecturally out of scope for daisyUI adoption but still needed the token-only touch-up. Found and fixed a real pre-existing bug blocking the new lint gate (`text-destructive-foreground`, never a defined token, in 4 files) |

## Governing principle (as approved)

daisyUI is the token/visual system everywhere; component classes were
adopted **only** where they're a genuine structural fit. The floating-ui
overlay family and the button-driven Switch/Checkbox kept their existing
markup and behavior — only their color classes moved to daisyUI's
vocabulary. This was a deliberate, plan-approved boundary, not an
unfinished migration — see the "UI Components" section of `CLAUDE.md`.

## Bugs found and fixed along the way

1. **`--color-neutral` illegible** — was `var(--secondary)` (near-white), making any `btn-neutral`/`badge-neutral` unreadable. Now sources from `--bg-sidebar`/`--text-sidebar-active`. Zero prior call sites, so zero visual impact before this fix.
2. **Dark-mode `info-content`/`error-content` contrast failure** — hardcoded `#FFFFFF`, 2.2:1 against their dark-mode fills (fails WCAG AA). Now real tokens with proper dark values (`#0D1B2E`, `#450A0A`).
3. **`text-muted-foreground` contrast** — `#94969A` on white was 2.97:1 (fails AA). Now derives from `color-mix(in oklab, var(--base-content) 60%, transparent)`, ~5:1. `.force-light` had already independently patched this exact problem — confirming the team already knew.
4. **`text-destructive-foreground` — dead class, 4 files** (`sprint-panel.tsx`, `task-activity-feed.tsx`, `space-members-manager.tsx`, `space-general-settings-form.tsx`). `--color-destructive-foreground` was never defined, before or after this migration — the class silently did nothing. Fixed to `text-error-content`, which is now a real token.
5. **`radio-group.tsx` SSR hydration mismatch** (found in Phase 0, **not fixed** — out of scope) — the auto-generated `name` fallback uses a module-level counter that drifts between server and client render when no explicit `name` prop is passed.
6. **`dropdown-menu.tsx` scroll-jump on very tall pages** (found in Phase 0, **not fixed** — out of scope) — its auto-focus-first-item effect can trigger a native scroll-into-view and leave the menu mispositioned. Didn't reproduce in `Popover` (same underlying `floating.tsx`), so it's narrow and specific to that file's effect, not the shared positioning engine. Unlikely to affect real app pages, which aren't nearly as tall as the QA kitchen-sink page that surfaced it.

## Explicitly deferred / out of scope

- **`bg-secondary`/`text-secondary-foreground`** — still the pre-migration pale-neutral token. `button.tsx`, `badge.tsx`, `sheet.tsx` still read it. Not part of the user's Phase 5b instruction (accent only); left untouched.
- **`components/ui/floating.tsx`, `overlay.tsx`, `overlay-stack.ts`** — zero diff across the entire migration, by design.
- **`.mask-btn*` / `.force-light`'s brand-green landing overrides** — self-contained, untouched except the mechanical rename needed to keep working.
- **Full rewrite of `docs/design-system.md`** — that doc predates even the pre-migration token system (`--color-brand`, `theme.extend`) and was already stale before this work. Updated only the Color Palette section to reflect current reality; the rest is pre-existing debt.

## Verification

- `pnpm typecheck` — clean throughout every phase.
- `pnpm build` — clean production compile, all routes.
- `pnpm lint` (Biome) — **fails**, but this is 100% pre-existing: ~2500 formatting/sort-order findings predate this branch (confirmed via `git stash` A/B comparison). Scoped, unlimited-diagnostic comparison of every file this migration touched (164 files) showed a **+7 delta**, all column-number shifts from renamed strings changing length — zero new substantive issues.
- `pnpm lint:tokens` (new gate, `scripts/lint-tokens.sh`) — clean. Fails the build if any legacy token class reappears outside `components/ui/`.
- Visual: computed-style diffs and screenshots captured at Phase 0, Phase 1, Phase 2, Phase 4, and Phase 6 across representative theme/mode combinations (up to all 22 `THEME_IDS` × light/dark), via a temporary `app/dev/kitchen-sink` QA route (deleted in Phase 6). Every diff matched an intentional, pre-documented change — nothing else moved.
- Behavioral: nested-overlay dismiss, focus trap, and keyboard interaction (checkbox Space-toggle, radio nav, Escape-to-close) spot-checked directly; the overlay engine's zero-diff status makes this low-risk by construction.

## Follow-ups worth tracking separately (not done here — out of scope)

- Resolve `--secondary` the same way `--accent` was resolved in Phase 5b.
- Fix the two pre-existing bugs noted above (#5, #6).
- `docs/design-system.md` still needs a full pass for everything past "Typography" (button variants, spacing, sidebar widths, etc. — all predate this migration and were already stale).
- ~2500 pre-existing Biome findings across the codebase, unrelated to this migration.
