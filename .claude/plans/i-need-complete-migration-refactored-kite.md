# Complete daisyUI Migration

## Context

Kanbanica already has daisyUI installed, but it's wired in backwards: `app/globals.css` loads daisyUI with `themes: false` and *bridges* daisyUI's expected CSS variables (`--color-base-100`, `--color-base-content`, etc.) onto this app's own hand-authored shadcn-style token layer (`--background`, `--foreground`, `--muted`, `--card`, `--primary`, ...). `components/ui/` primitives are a hybrid — some already wear daisyUI's component classes (`btn`, `card`, `badge`) skinned by the bridged tokens, others (dialog, popover, dropdown-menu, select, tooltip, accordion, switch, checkbox, radio-group, table, label, separator) don't use daisyUI classes at all despite direct equivalents existing. Feature code (`app/`, `components/*` outside `ui/`) never touches daisyUI classes directly — it styles wrapper markup against the shadcn token utilities (`bg-background`, `text-muted-foreground`, `border-border`, `bg-accent`, ...), in ~137–142 of 196 non-primitive files.

The user wants the reverse architecture:
```
daisyUI theme tokens → daisyUI component classes → Headless UI/custom behavior ONLY where daisyUI can't provide it → Tailwind utilities ONLY for layout/custom details
```

This was scoped via 5 research agents (3 exploration + 2 design), cross-checked against the live files. Key findings that shape the plan:

- **The bridge just needs inverting, not replacing.** `@theme inline` already contains the exact shim needed to keep both the old and new utility names resolving to identical colors during the migration — so the token rewrite (Phase 1) can ship as an isolated, provably-invisible commit, and every later phase can move independently instead of in lockstep.
- **The `accent` collision resolves cleanly, empirically.** shadcn's `--accent` (`bg-accent`, used almost entirely as `hover:bg-accent`) is a low-chroma surface tint (OKLCH chroma 0.01–0.038 across all 22 theme blocks) — not a brand color. It maps to daisyUI's `base-200` (which is also daisyUI's own hover convention, confirmed in `node_modules/daisyui/daisyui.css`), not to daisyUI's `accent` role (a vivid third brand color, currently used nowhere in the app). Of 355 `accent`-class hits, 340 are unambiguous `hover:`/`focus:`/`active:`-prefixed and fully mechanical; only ~65 bare `bg-accent`/`text-accent-foreground` sites need a human judgment call.
- **Several duplicate/dead tokens collapse for free**: `--card`/`--popover`/`--bg-elevated` are byte-identical → merge into one custom `--bg-elevated` (daisyUI has no 4th surface level, so this can't just become `base-100`). `--input` == `--border-color` → both become `base-300`. `--secondary`/`--accent` per-theme values differ only in the 3rd decimal → both free up and alias `--primary` (the app has one brand color today; nothing uses `btn-secondary`/`badge-accent` for a distinct hue). `--danger`, `--danger-muted`, `--info-muted`, `--warning-muted` have zero references anywhere and get deleted.
- **The migration surfaces a few real, pre-existing bugs**, worth fixing in the same pass since the blocks are already being touched: `--color-neutral: var(--secondary)` today makes daisyUI's `neutral` role render near-white/illegible; dark-mode `info-content`/`error-content` are hardcoded to `#FFFFFF`, which is 2.2:1 against their light dark-mode fills (fails WCAG AA); `text-muted-foreground` is 2.97:1 against white (fails AA) — `.force-light` already independently patched this exact problem to `#5E6573`, confirming the team already knows.
- **`components/ui/button.tsx:16` and `badge.tsx:13`** explicitly reference `bg-secondary`/`badge-secondary` — once `--secondary` aliases `--primary`, these must be repointed to `base-200`-based styling in the same commit, or the "secondary" button/badge variant silently turns brand-colored.
- **The floating-UI-based overlays** (`dialog.tsx`, `popover.tsx`, `dropdown-menu.tsx`, `select.tsx`, `tooltip.tsx`, `sheet.tsx`, `alert-dialog.tsx`) wrap an in-house portal/focus-trap/dismiss-stack system (`components/ui/floating.tsx`, `overlay.tsx`, `overlay-stack.ts`) that has **zero daisyUI or styling coupling** and must not be touched — daisyUI's native `<dialog>` modal, checkbox-hack drawer, and CSS-focus dropdown are architecturally incompatible with the portal + controlled-state system already built. For these files, "migrate to daisyUI" means adopting daisyUI's visual class vocabulary, not its interaction mechanism.
- **5 primitives have no daisyUI equivalent and need no architectural change**: `combobox.tsx` (Headless UI), `calendar.tsx` (react-day-picker), `sonner.tsx` (sonner), `form.tsx` (react-hook-form glue, no markup), `slot.tsx` (asChild polyfill, no markup).
- **`.force-light`** (landing/marketing page override) and **`.mask-btn*`** (landing CTA ink-spray system, self-contained `--mb-*` namespace) are out of scope for restyling, but `.force-light` *reads the raw token names directly* and must be updated in lockstep with Phase 1 (its rendered output must not change — the file region does change).

## Governing principle: tokens everywhere, component classes only where they actually fit

**The rule is not "convert every primitive to the matching daisyUI component."** It is: *use daisyUI component classes wherever they faithfully match the existing DOM and behavior; where a primitive requires different markup, accessibility semantics, positioning, interaction, or animation, keep the existing implementation and only adopt daisyUI's tokens/classes where they genuinely apply.* daisyUI is the visual design system (colors, spacing, radii — via the token layer from Phase 1, consumable as plain Tailwind utilities like `bg-base-100`/`text-base-content`/`border-base-300` regardless of whether a component class is used); Headless UI/Floating UI/the in-house `floating.tsx`/`overlay.tsx` stack remains the behavior layer; custom implementations are kept wherever daisyUI cannot provide equivalent behavior.

This matters because several daisyUI component classes carry CSS that assumes daisyUI's own exact markup shape or a native browser state (`:checked`, `:focus-within`, specific child/sibling selectors) — applying just the class name to structurally different custom markup can produce partial or broken styling, not just "same behavior, new colors." Each primitive below gets a real compatibility check at implementation time, not an assumed conversion. Known/likely outcomes going in:

- **Likely token-only (keep current markup, style with plain Tailwind utilities against the new tokens, skip the daisyUI component class):** `checkbox.tsx` and `switch.tsx` (both render `<button role="checkbox"|"switch">` with manual `aria-checked`/`data-checked`, not a native input — daisyUI's `.checkbox`/`.toggle` styling targets the browser's own `:checked` pseudo-class, which never applies to a `<button>`), `radio-group.tsx` (hides a real `<input type="radio">` and renders a separate custom dot on top — daisyUI's `.radio` styles the input itself as the visible circle, which conflicts with that pattern), `dialog.tsx`/`sheet.tsx`/`alert-dialog.tsx`/`popover.tsx`/`dropdown-menu.tsx`/`select.tsx`/`tooltip.tsx` (all portal-rendered via the in-house `floating.tsx`/`overlay.tsx` system with controlled React state — daisyUI's native `<dialog>` modal, checkbox-hack drawer, `:focus-within`-based dropdown, and CSS-only `data-tip` tooltip assume a completely different DOM/interaction shape), `accordion.tsx` (custom ResizeObserver-driven JS height animation — daisyUI's `.collapse` relies on a CSS grid-rows transition keyed to a hidden checkbox/radio or `tabindex`, which would fight the existing JS-driven approach), `separator.tsx` (daisyUI's `.divider` assumes a flex-row layout with optional centered text and pseudo-element lines either side; needs a quick check against this component's actual markup before assuming it's a drop-in).
- **Likely class-compatible (native or simple-enough markup that the daisyUI class should apply cleanly):** `button.tsx` (real `<button>`), `card.tsx`/`badge.tsx`/`alert.tsx` (plain divs/spans, no pseudo-class dependency), `input.tsx`/`textarea.tsx`/`search-input.tsx` (native form elements), `label.tsx`, `avatar.tsx`, `skeleton.tsx`, `spinner.tsx`, `progress.tsx` (decorative class only — already established the bar itself stays custom), `table.tsx` (plain `<table>`/`<tr>`/`<td>`, no interactive state), `tabs.tsx` (Headless UI already renders standard ARIA `role="tab"`/`role="tabpanel"` markup, and this file already uses `tabs`/`tab` classes successfully today).

Where a component lands in the token-only bucket, its Phase 2/3/4 entry below still gets fully re-themed (colors, radii, spacing all move to the new token names) — it just doesn't pick up the daisyUI component class name, and its existing behavioral code (ARIA roles, keyboard handling, animation) is untouched.

Given the scale (~170 files, 22 theme variants, the entire visual system), this executes as a sequence of small, independently shippable phases rather than one large change — each phase leaves `pnpm build` / `pnpm typecheck` / the app itself green.

---

## Token / Theme Rename Table

Reference table for Phase 1 and all later phases. "New utility" is what replaces the old Tailwind class everywhere it appears (`components/ui/`, feature code, docs).

### Base surfaces

| Old raw var | Old utility | New raw var | New utility | Value (light / dark) |
|---|---|---|---|---|
| `--background` | `bg-background` | `--base-100` | `bg-base-100` | `#FFFFFF` / `#161A20` |
| `--muted` | `bg-muted` | `--base-200` | `bg-base-200` | `#F4F5F7` / `#2B323D` |
| `--accent` (surface use) | `bg-accent`, `hover:bg-accent` | merges into `--base-200` | `bg-base-200`, `hover:bg-base-200` | per-theme (see below) |
| `--secondary` | `bg-secondary` | merges into `--base-200` | `bg-base-200` | 0 feature usages today |
| `--border-color` | `border-border` | `--base-300` | `border-base-300` | `#E4E7EC` / `#333B47` |
| `--input` | `border-input` | merges into `--base-300` | `border-base-300` | byte-identical to border-color |
| `--foreground` | `text-foreground` | `--base-content` | `text-base-content` | `#0F1117` / `#F0F2F5` |
| `--card-foreground` / `--popover-foreground` | `text-card-foreground` etc. | merges into `--base-content` | `text-base-content` | byte-identical |
| `--muted-foreground` | `text-muted-foreground` | opacity of base-content | **`text-base-content/60`** | see delta #1 below |
| `--accent-foreground` | `hover:text-accent-foreground` | merges into `--base-content` | `hover:text-base-content` | see delta #2 |
| `--card` / `--popover` | `bg-card`, `bg-popover` | custom `--bg-elevated` (kept, no daisyUI 4th surface) | `bg-elevated` (custom Tailwind color, not daisyUI-namespaced) | `#FFFFFF` / `#242A33` |

### Brand roles

| Old | New | Notes |
|---|---|---|
| `--primary` / `--primary-foreground` | `--primary` / `--primary-content` | rename `-foreground` → `-content`; per-theme, unchanged values |
| `--color-neutral: var(--secondary)` (bug) | `--neutral: var(--bg-sidebar)`, `--neutral-content: var(--text-sidebar-active)` | **bug fix** — today `btn-neutral` renders illegible near-white |
| *(freed)* `--secondary` / `--secondary-content` | alias `var(--primary)` / `var(--primary-content)` | single-brand-color app; keeps `btn-secondary`/`badge-secondary` legible |
| *(freed)* `--accent` / `--accent-content` | alias `var(--primary)` / `var(--primary-content)` | daisyUI's real "accent" role currently used nowhere |

### Status roles

| Old | New | Fix bundled |
|---|---|---|
| `--destructive` | `--error` (`bg-destructive`→`bg-error`, `text-destructive`→`text-error`) | — |
| `--color-error-content: #FFFFFF` (hardcoded) | tokenized `--error-content` | dark: `#450A0A` (was 2.2:1 on `#F87171`, now AA) |
| `--info` | `--info` (name unchanged) | — |
| `--color-info-content: #FFFFFF` (hardcoded) | tokenized `--info-content` | dark: `#0D1B2E` (was 2.2:1 on `#60A5FA`, now AA) |
| `--success` / `--color-success-content: var(--success-foreground)` | `--success` / tokenized `--success-content` | on-solid values, not the soft-badge pair (see below) |
| `--color-warning-content: #451A03` (hardcoded) | tokenized `--warning-content` | value unchanged, both modes |
| `--success-foreground` (soft-badge text) | **kept as custom** `--success-strong` | daisyUI's `-content` is for on-solid text, not the tinted-badge pair; keep `--success-subtle` + `--success-strong` as non-daisyUI tokens |

### Functional / radii — unchanged

`--radius`, `--radius-sm/md/lg/xl/2xl/3xl/4xl`, `--radius-selector/field/box`, `--size-selector`, `--size-field` stay as-is (already daisyUI-compatible or pure Tailwind namespace). **`--border: 1px`, `--depth: 0`, `--noise: 0` stay exactly as-is** — these are daisyUI's skeuomorphic-shading/grain knobs, not tokens; flipping them would restyle every button/card in one commit and conflate a mechanical rename with an unreviewed visual redesign. If flat-vs-skeuomorphic is ever revisited, it's a separate one-line follow-up, not part of this migration.

⚠️ **`--border` (width, daisyUI-native, stays) vs `--border-color` (color, being renamed to `base-300`) are different concepts that share a confusing prefix today** — don't let any mechanical find/replace conflate them.

### Custom tokens — no daisyUI slot, kept as plain (non-`--color-`-namespaced) CSS vars

`--ring` (daisyUI has no focus/ring role), `--bg-app` / `--bg-elevated` (surface levels below/between daisyUI's base ramp), `--bg-sidebar*` / `--text-sidebar*` (app-shell chrome, dark in both modes, doubles as the `--neutral` source), `--success-subtle` + `--success-strong` (soft-badge pair), `--shadow-*`, `--ease-*` / `--duration-*` (motion), typography vars, `--page` (audit candidate — near-duplicate of `--bg-app`), `--scrollbar-thumb*`. **Delete outright** (zero references anywhere): `--danger`, `--danger-muted`, `--info-muted`, `--warning-muted`.

### Intentional visual deltas (accepted, not pixel-parity)

| # | What changes | Files affected | Why it's the right call |
|---|---|---|---|
| 1 | `text-muted-foreground` → `/60` opacity (was effectively `/45`) | 125 | fixes a real 2.97:1 AA failure; `.force-light` already independently patched this exact value |
| 2 | Light-mode hover text loses its brand tint (`accent-foreground` → neutral `base-content`) | 72 | artifact of `accent` being overloaded as both "brand" and "neutral hover"; hover text should be neutral |
| 3 | `bg-muted` fills pick up a subtle per-theme tint (share `base-200` with hover) | 63 | matches daisyUI's own per-theme base-ramp tinting; delta is small (chroma ≤0.038) |
| 4 | `btn-neutral` goes illegible-near-white → dark/legible | 2 (button/badge internals) | bug fix |
| 5 | Dark-mode `info-content`/`error-content` go white → dark | daisyUI alert/badge internals | fixes 2.2:1 contrast failures |
| 6 | `btn-secondary`/`badge-secondary` retargeted off the freed `--secondary` alias | `button.tsx:16`, `badge.tsx:13` | must ship in the same commit or these variants turn brand-colored |

---

## Phases

Each phase is its own commit (or small commit series), independently buildable and shippable. Do not start a phase until the previous one is green.

### Phase 0 — Pre-flight
- Ensure a clean working tree before starting (check `git status`; the branch currently has staged docs/README changes unrelated to this migration — land or stash them first so mechanical-rename diffs stay reviewable).
- Add a temporary dev-only kitchen-sink route (e.g. `app/dev/kitchen-sink/page.tsx`, `notFound()` in production) rendering every `components/ui/` primitive × variant × size × state on one page, plus a token swatch grid. Deleted in Phase 6.
- Capture baseline: screenshot the kitchen sink and dump `getComputedStyle(document.documentElement)` for all 22 `data-theme` × light/dark combinations (11 `THEME_IDS` from `lib/theme.ts`).

### Phase 1 — Token layer inversion (`app/globals.css` only, zero `.tsx` changes)
Rewrite `@theme inline` (lines 141–229), `:root`/`.dark` (231–389), and all 22 accent blocks (401–~628) per the rename table above, keeping the exact same selector structure (`:root[data-theme="X"]`, `.dark[data-theme="X"]`, dark blocks last in source order, `themes: false` retained). Each accent block drops from 7 declared vars to 4 (`--primary`, `--primary-content`, `--ring`, `--base-200`) — `--secondary`/`--accent`/`--secondary-content`/`--accent-content` no longer need per-theme values since they alias `--primary` globally.

Update in the same commit (mechanical renames only, no value changes — these read the raw token names directly and must not silently break):
- `.force-light` (~lines 761–789)
- `@layer base` (~791–813): `border-border` → `border-base-300`, `bg-background text-foreground` → `bg-base-100 text-base-content`
- `.ProseMirror` / `.mention` / `.tippy-box[data-theme~="mention-popup"]` (~631–758) — note this last selector's `data-theme` is Tippy's own convention, unrelated to the app; don't touch its logic, only the `var()` references inside it

Explicitly do NOT touch: `.mask-btn*` (self-contained `--mb-*` namespace, verified zero outside references), the `@custom-variant data-*` blocks (animation-only, no color tokens), `lib/theme.ts`, `components/theme/theme-provider.tsx`, `app/layout.tsx`'s pre-hydration script, the cookie/DB delivery mechanism.

**Verification:** `pnpm build` passes; the 22 post-change computed-token dumps are byte-identical to Phase 0 baselines *except* for the intentional deltas listed above (diff should show only those specific vars changing, nothing else). Kitchen-sink screenshots match on every color that isn't an accepted delta.

### Phase 2 — Leaf primitives
No overlay behavior, no state machines. Order (ascending risk, not file size):
`skeleton.tsx` / `spinner.tsx` (verify-only, already daisyUI) → `separator.tsx` (check whether `.divider`'s flex-row/pseudo-element-line layout actually matches this component's markup before adopting it; if not, keep current markup and swap its border/bg color to `base-300` via plain Tailwind utilities) → `label.tsx` (adopt daisyUI `label`, a plain non-native-state class) → `progress.tsx` (keep the hand-built div bar — it's not a native `<progress>`, just apply new token names + `progress` skin) → `input.tsx` / `textarea.tsx` / `search-input.tsx` (native elements, adopt directly) → `alert.tsx` (adopt `alert-error`/`alert-warning`/`alert-info`) → `badge.tsx` (full `badge-*` variant set; fix the `badge-secondary` delta #6) → `card.tsx` (preserve the existing `--card-spacing` var — `table.tsx` and `app/(orbit)/orbit/page.tsx` read it externally) → `button.tsx` (highest token count and highest import count — 73 importers; its own reviewed commit; fix the `btn-secondary` delta #6 and the `color-mix(..., var(--secondary), ...)` hover reference) → `avatar.tsx` (keep the custom `AvatarContext` image-load-state; skin only).

**Verification:** kitchen-sink screenshots on `forest` light/dark + one spot-check theme (e.g. `blue` dark) per sub-step — sufficient because the 22 theme blocks only vary 4 properties now, so per-theme risk is confined to "does the brand hue arrive," provable on one theme.

### Phase 3 — Form controls
`switch.tsx` and `checkbox.tsx` — per the governing principle, these render `<button role="switch"|"checkbox">` with manual `aria-checked`/`data-checked`, not native inputs, so daisyUI's `.toggle`/`.checkbox` (which style the `:checked` pseudo-class) will not just work by adding the class. Default: keep the existing `role`/`data-checked` contract untouched (the `@custom-variant data-checked` in globals.css depends on it, and `table.tsx`'s `:has([role=checkbox])` selector depends on `checkbox.tsx`'s role staying put) and restyle the checked/unchecked/hover states with plain Tailwind utilities against the new tokens (`bg-primary`/`bg-base-300`/`border-base-300`, etc.) instead of the daisyUI class. Only adopt `.toggle`/`.checkbox` directly if a quick spike proves the class still renders correctly against a non-native `role`-based element (e.g. by also mirroring the relevant `:checked`-driven CSS via `data-*` attribute selectors) — treat that as a stretch goal, not the default plan.

`radio-group.tsx` — similarly check before converting: it hides a real `<input type="radio">` and layers a separate custom dot on top, whereas daisyUI's `.radio` styles the native input itself as the visible circle. If adopting `.radio` would mean removing the custom dot markup, treat that as a structural change to evaluate on its own merits (not a blanket "yes, easy — it's already a real input"), not an automatic default.

`table.tsx` → `table`/`table-zebra` classes — plain `<table>`/`<tr>`/`<td>` markup with no pseudo-class/behavioral dependency, so this is the one Phase 3 primitive expected to be class-compatible without a fallback path; preserve the `--card-spacing`-driven first/last-child padding while adopting it.

**Verification:** manual keyboard pass (Space/Enter toggle, arrow-key roving) on `/[workspaceId]/[spaceId]/settings/custom-fields` and `/[workspaceId]/settings/members` — the two screens exercising all four controls plus `form.tsx`/react-hook-form integration.

### Phase 4 — Overlay family: tokens over the existing markup, behavior and (usually) component classes untouched
Hard rule, worth stating in each commit message: daisyUI's native `<dialog>` modal, checkbox-hack drawer, `:focus-within`-based dropdown, and CSS-only `data-tip` tooltip assume a DOM/interaction shape that the portal + controlled-state + `overlayLayers` dismiss-stack system already built does not provide — do not touch `floating.tsx`, `overlay.tsx`, `overlay-stack.ts`, or the `data-open:animate-in`/`data-closed:animate-out` classes (paired with `tw-animate-css` + the `@custom-variant data-open/data-closed` definitions). Per the governing principle, the default for every file in this phase is **token-only**: keep the exact current markup and interaction code, and restyle it with plain Tailwind utilities against the new token names (`bg-base-100`, `text-base-content`, `border-base-300`, `shadow-lg`, `rounded-box`, etc.). Adopt an actual daisyUI component class (`.modal-box`, `.dropdown-content`, `.select`, `.tooltip`, `.collapse`) only where a specific check at implementation time shows it applies cleanly to the existing DOM without fighting the custom positioning/state logic — expect this to be the exception, not the rule, for this phase.

Order by import count, not file size: `tabs.tsx` (Headless UI `TabGroup` renders standard ARIA tab markup and already uses `tabs`/`tab` classes successfully today — keep that adoption, just move to the new tokens) → `accordion.tsx` (custom ResizeObserver-driven height animation; check whether `.collapse`'s CSS grid-rows transition can coexist with it before adopting the class — likely token-only, keeping the current expand/collapse implementation) → `tooltip.tsx` (keep floating-ui placement — daisyUI's `.tooltip`/`data-tip` can't do viewport-aware positioning; token-only) → `dropdown-menu.tsx` (largest file, only 3 importers — good place to do the compatibility check first since a mistake here is cheap to fix) → `select.tsx` → `popover.tsx` (highest-traffic overlay, 30 importers) → `dialog.tsx` + `sheet.tsx` + `alert-dialog.tsx` **together in one PR** (the latter two are built wholesale on `dialog.tsx`; splitting guarantees an intermediate broken state).

**Verification:** manual pass on `/[workspaceId]/task/[taskId]` (densest overlay surface — dropdown, dialog, popover, tooltip, accordion, tabs all present) and `/[workspaceId]/[spaceId]/list/[listId]`. Explicitly test the nested case: open a Dialog → open a Select inside it → Escape closes only the Select.

### Phase 5 — Feature-code sweep (~137–142 files)

**5a — Mechanical bucket (every token except `accent`).** Use an ordered `sed`/regex rename script driven by the table above, run one directory at a time, one commit per batch, `git diff` reviewed per batch — not an AST codemod (jscodeshift/ts-morph), because the relevant strings live inside `cva()` variant maps and `cn()` calls as often as JSX attributes, and a JSX-targeting codemod would silently miss those. Run renames **longest-key-first** (`bg-accent-foreground` before `bg-accent`), anchored on `[\s"':\[\]]` boundaries, allowing arbitrary variant prefixes (`hover:`, `dark:`, `md:`, `data-[...]:`) and an optional `/opacity` suffix.

Batch order (largest first): `components/task/` (18) → `components/workspace-overview/` incl. `charts/` (12, hand-edit the chart's `var(--muted-foreground)`/`var(--info)`/`var(--success)` SVG references alongside the className sweep) → `components/workspace/` (11) → `components/sprint/` (9) → `components/list/` (8) → board/task-detail `_components/` under `app/(app)/[workspaceId]/[spaceId]/list/[listId]/` (7) → `components/orbit/` + `components/channel/` + `components/space/` (17) → remainder (~60: `components/{profile,filters,notifications,common,search,scaffold,my-tasks,admin,realtime}/`, `app/(auth)/`, `app/(orbit)/`, `app/admin/`, `app/setup/`, `app/join/`, `app/dashboard/`). Also hand-edit `components/ui/sonner.tsx`'s CSS-var overrides (not class-based).

Because the Phase 1 alias shim is still live, every 5a batch is a provable no-op (old and new class names resolve to the same color) — verification is `git diff` review + `pnpm build`/`typecheck`, not a visual pass, except:

**5b — The `accent` phase, isolated, its own PR, after all of 5a.** Mechanical: the ~340 `hover:`/`focus:`/`active:`-prefixed `bg-accent` hits → `base-200`. Manual: the ~65 bare `bg-accent`/`text-accent-foreground` hits (~30 files) — for each, decide "persistent selected/active surface" vs "genuine emphasis," per the design notes above. Then retire `--accent`/`--accent-foreground` from `:root`/`.dark`/all 22 theme blocks/`.force-light`.

**Verification for 5b:** hover-state pass (not just static screenshots) on the 5 representative screens below, `forest` light + dark, plus a static kitchen-sink screenshot across all 22 combos since this is the one token whose per-theme value is genuinely changing.

**Explicitly excluded from the sweep** (no architectural change, token-class touch-up only if any string matches): `combobox.tsx`, `calendar.tsx`, `form.tsx`, `slot.tsx`. **Refuse as out of scope even if tempting mid-sweep**: converting the ~47 hand-rolled `rounded-xl border bg-card p-6` surfaces that duplicate `<Card>` into actual `<Card>` usage, any prop/API renames, `dark:` variant consolidation.

### Phase 6 — Shim removal & enforcement
1. Delete the shadcn alias entries from `@theme inline` and the raw `:root`/`.dark` aliases (`--background`, `--foreground`, etc. as pass-throughs) — the build should fail loudly on any missed consumer; that failure *is* the completion test.
2. Re-verify `@layer base` still points at `base-100`/`base-content`/`base-300` (already repointed in Phase 1 — just confirm nothing regressed).
3. Add a `grep`-based `lint:tokens` script (allowlist-driven) to CI, failing on any legacy token utility outside the allowlist. Don't try to do this via Biome — `components/ui/` is explicitly excluded from Biome's `files.includes` in `biome.jsonc`, and there's no relevant rule; a grep gate is the proportionate tool here.
4. Delete the Phase 0 kitchen-sink route.
5. Update `docs/design-system.md` and the "UI Components" section of `CLAUDE.md` to reflect the new token vocabulary.

**Verification:** zero legacy token names remain (`grep` across `app/`+`components/`), `lint:tokens` passes, full 22-combo kitchen-sink screenshot set reviewed once more against the Phase 0 baseline (accounting for the accepted deltas).

---

## Verification strategy (applies across phases)

Three tiers, not a 22× manual click-through:

1. **Computed-value diff** (Phase 1 only) — `getComputedStyle` dumps before/after, diffed programmatically. The only phase with a fully machine-checkable invariant.
2. **Kitchen-sink screenshot, one page, N themes** — full 22-combo only for Phase 1, Phase 5b, and Phase 6 (the only phases where a per-theme value actually changes); every other phase checks `forest` light/dark + one spot-check theme, justified by the fact each accent block only varies 4 properties.
3. **Five representative screens, single theme, for behavior**: `/[workspaceId]/[spaceId]/list/[listId]` (table/badges/dropdowns/checkboxes/drag), `/[workspaceId]/task/[taskId]` (Tiptap, every overlay type), `/[workspaceId]/overview` (charts/cards/stats), `/[workspaceId]/settings/members` + `/[spaceId]/settings/custom-fields` (forms/dialogs/selects/switches), `/login` + a `(legal)` page (the `.force-light` path — proves the excluded landing surface stayed excluded).

Standard checks every phase: `pnpm build`, `pnpm typecheck` (`tsc --noEmit`), `pnpm lint` (`biome check`), plus CLAUDE.md's border-radius/hover/focus-ring consistency check on anything visually touched.

## Critical files

- `app/globals.css` — the entire Phase 1/6 diff (`@theme inline` 141–229, `:root`/`.dark` 231–389, 22 accent blocks 401–~628, `.ProseMirror`/`.mention` block 631–758, `.force-light` 761–789, `@layer base` 791–813)
- `components/ui/button.tsx` (line 16), `components/ui/badge.tsx` (line 13) — the `btn-secondary`/`badge-secondary` regression to fix in Phase 2
- `components/ui/dialog.tsx`, `sheet.tsx`, `alert-dialog.tsx` — ship together in Phase 4
- `components/ui/floating.tsx`, `overlay.tsx`, `overlay-stack.ts` — must remain byte-for-byte unchanged through the whole migration
- `lib/theme.ts`, `components/theme/theme-provider.tsx`, `app/layout.tsx` — read-only references for `THEME_IDS` and the delivery mechanism; do not modify
- `biome.jsonc` — confirms no lint enforcement exists today; informs the Phase 6 `lint:tokens` approach
