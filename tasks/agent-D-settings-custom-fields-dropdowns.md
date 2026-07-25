# Agent D — Settings, Custom Fields & Dropdown Consistency

**Scope owner:** all settings surfaces (workspace/project/list/notification), Custom Fields, and shared dropdown styling.
**Files you own (safe to edit freely):**
- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/settings/layout.tsx` (+ `general/`, `statuses/` pages)
- `app/(app)/[workspaceId]/[spaceId]/settings/layout.tsx` (+ `general/`, `members/`, `sprints/`, `custom-fields/` pages)
- `app/(app)/[workspaceId]/settings/layout.tsx` (+ `general/`, `members/`, `security/`, `themes/`)
- `app/(app)/[workspaceId]/notifications/settings/page.tsx`
- `components/space/custom-fields-settings.tsx`, `components/space/space-settings-nav.tsx`
- `components/list/list-settings-nav.tsx`
- `components/sprint/sprint-settings-form.tsx`, `components/sprint/sprint-settings-modal.tsx`
- `components/workspace/theme-settings-form.tsx`
- `app/actions/custom-field.ts`

**Coordinate before touching (owned by other agents):**
- `components/workspace/workspace-shell.tsx` — items #10 and #14 move page headers **into the topbar**, which means editing the shell. Agent A (#7) also depends on the topbar's pin indicator. **Announce your shell change** and keep it additive (a header/title slot) rather than restructuring the topbar.
- #20 touches dropdown styling used across List (Agent B) and Board (Agent C). Fix the **shared primitive / settings-side dropdowns**; do **not** restyle Board or List view components directly while B and C are working. If a shared `components/ui/*` change is needed, announce it first — it affects everyone.

---

## Read first
- `CLAUDE.md` (root) — **Custom Fields section is critical for #13** (Archive vs Delete are intentionally separate, Delete is permanent + cascades), UI Consistency, shadcn-only, Confirmation Dialogs (never `window.confirm`), Real-time Sync.
- `docs/custom-fields.md`, `docs/settings.md`, `docs/design-system.md`, `docs/ui-redesign.md`, `docs/permission-model.md`.
- **Every fix ships a bug + solution doc pair in `docs/bugs/`** (today = 2026-07-24).

---

## Items

### #10 — Move the page header into the topbar (List Settings)
**Reported:** The "List — Settings / Manage this List" header sits in the content area; it should live in the **topbar** (screenshot arrow points at the empty topbar).
**Where:** `app/(app)/[workspaceId]/[spaceId]/list/[listId]/settings/layout.tsx` + the topbar in `components/workspace/workspace-shell.tsx`.
**Do:** Render the settings page title/breadcrumb in the topbar instead of duplicating it in the content body. Prefer an additive title/slot mechanism in the shell so other pages can reuse it. Keep the "Back to list" affordance reachable.
**Acceptance:** List Settings shows its title in the topbar; content area no longer duplicates the header; spacing consistent with other pages.

### #14 — Move the page header into the topbar (Notification Settings)
**Reported:** Same as #10, for notification settings.
**Where:** `app/(app)/[workspaceId]/notifications/settings/page.tsx` (+ `notifications/layout.tsx`).
**Do:** Reuse the exact mechanism you build for #10 — do not invent a second pattern. Apply consistently to the other settings layouts (project/workspace) if they have the same duplication.
**Acceptance:** Notification settings title renders in the topbar via the same shared mechanism as #10.

### #12 — Verify theme scope: workspace-level vs. global  ❓ QUESTION, NOT A BUG
**Reported:** "Theme setting should be global, but it's workspace-level. Check once."
**Where:** `app/(app)/[workspaceId]/settings/themes/page.tsx`, `components/workspace/theme-settings-form.tsx`, `components/theme/theme-provider.tsx`, and `docs/settings.md`.
**Do:** **Investigate and report — do not change behavior without sign-off.** Determine what is actually workspace-scoped (accent color / appearance) vs. user-scoped, and whether that matches `docs/settings.md`. Two reasonable models: (a) workspace sets brand accent, user sets light/dark; (b) fully per-user. Write up the current behavior + a recommendation.
**Acceptance:** A short written answer (in your `docs/bugs/` note or a reply) stating current scope, whether it matches the spec, and the recommendation. Code change only if product confirms.

### #13 — Custom field delete: no trash/restore, no warning about existing values  ⚠️ CONFLICTS WITH CURRENT SPEC
**Reported:** Deleting a custom field permanently destroys stored task values. ClickUp warns ("will delete this Custom Field from **1 task**") and offers admin-restorable **Trash**. Our app does neither.
**Status:** CLAUDE.md is explicit today: Archive (reversible, keeps values) and Delete (permanent, cascades via `onDelete: "cascade"`) are **intentionally separate, non-overlapping paths**. A trash/restore flow is a **scope change to `docs/custom-fields.md`**, not a bug fix. **Get product sign-off before building it.**
**Recommended split:**
  1. **Ship now (low risk, no spec conflict):** make the delete confirmation dialog state the blast radius — "This will delete this custom field and its values from **N tasks**." Requires counting `customFieldValue` rows for the definition. Keep the standard shadcn confirm Dialog (never `window.confirm`), centered `TrashIcon` in a red circle, Cancel + destructive Delete.
  2. **Only if approved:** soft-delete + Trash with admin restore, honoring `requireFieldAdmin()` permissions, plus a `docs/custom-fields.md` update.
**Do:** Implement (1). Raise (2) as a product decision with a short proposal.
**Acceptance:** Delete dialog shows the affected task count before destroying values; behavior otherwise unchanged unless (2) is approved.

### #18 — Custom field "Create Field" dialog: full-width Type dropdown, no ALL-CAPS labels
**Reported:** In the Create Field dialog, the **TYPE** select is narrow while every other input is full width; and field labels are rendered in all caps ("NAME", "DESCRIPTION", "PLACEHOLDER", "DEFAULT VALUE").
**Where:** the field form dialog (`FieldFormDialog`) in `components/space/custom-fields-settings.tsx`.
**Do:** Make the Type shadcn `Select` full width to match the other inputs. Replace the uppercase label treatment with normal sentence-case labels per `docs/design-system.md`. Remember the Type select stays **disabled in Edit mode** (type can't change after creation) — don't regress that.
**Acceptance:** Type select spans the dialog width; labels are sentence case; Edit mode still disables Type; dialog uses `rounded-xl`.

### #19 — "Archive" menu item needs an icon and reads as disabled
**Reported:** In the custom-field row action menu, **Edit** and **Delete** have icons but **Archive** does not, and Archive's text color makes it look disabled.
**Where:** the row actions dropdown in `components/space/custom-fields-settings.tsx`.
**Do:** Add an appropriate archive icon and fix the text color so it reads as an enabled, neutral (non-destructive) action — consistent with Edit, and clearly distinct from the destructive red Delete.
**Acceptance:** Archive has an icon and normal enabled text color; menu items are visually consistent.

### #20 — Inconsistent dropdown UI across the app
**Reported:** Dropdowns look different in different places — the Sprint settings "Schedule" day picker (plain bordered list) vs. the Assignee filter (search + checkable list). They should share one consistent style.
**Where:** `components/sprint/sprint-settings-form.tsx` (settings-side, yours) and the filter facets (`components/filters/facet-filter.tsx`, used by List/Board — **coordinate with B/C**).
**Do:** Define one dropdown style per the design system and bring the **settings-side** dropdowns (start day, default duration, date format) onto the standard shadcn `Select`/`Command` treatment: consistent radius (`rounded-md` trigger, `rounded-xl` popover), padding, hover/focus rings, and check indicator. Do **not** restyle List/Board filter components while Agents B and C are active — instead note any shared change needed and announce it.
**Acceptance:** Settings dropdowns match the app's standard dropdown look; a written note of any shared `components/ui` change proposed for B/C's surfaces.

---

## Definition of done (all items)
- shadcn only; `rounded-xl` surfaces/popovers/dialogs, `rounded-md` buttons/inputs/triggers; no native `<select>`.
- Never `window.confirm` — shadcn `Dialog` with Cancel + destructive Delete.
- All mutations call `refreshWorkspace`.
- Respect `requireFieldAdmin()` permissions on custom-field changes.
- **#12 and #13(2) are decisions, not code** — report, don't unilaterally implement.
- **Announce your topbar (#10/#14) and any shared `components/ui` (#20) changes** — they are the only cross-agent collision points in this batch.
- Ship the `docs/bugs/` bug+solution pair for the real fixes (#18, #19, #20, and #13 part 1).
