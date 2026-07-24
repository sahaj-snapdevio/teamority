# Agent B — List View

**Scope owner:** the List view (rows, bulk actions, inline quick-edits, sorting, due-date editing).
**Files you own (safe to edit freely):**
- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-view.tsx`
- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-container.tsx`
- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/quick-create-task.tsx`
- `components/task/task-list-row.tsx`
- `components/task/quick-task-meta.tsx`
- `components/list/list-filter-toolbar.tsx` (Sort control lives here today)

**Coordinate before touching (owned by other agents):**
- The **pin/unpin server action** is shared with Agent A (#7). For #2 you fix the bulk-action wiring in the list view only — do **not** change the pin action's signature. Read the action first.
- **Due-date server action / task update** (#3): this same action is used by Board (Agent C) and the task detail (Agent A). Decide the start/end-date semantics **in the shared action** carefully and post the decision so C/A stay consistent. See #3.
- If #5 (sortable table headers) requires a shared table/sort primitive, keep it inside list-view for now; don't refactor a global component that Board relies on.

---

## Read first
- `CLAUDE.md` (root) — UI Consistency (`rounded-xl`, shadcn-only, no native `<input type="date">`), Undo Toast, Real-time Sync (`refreshWorkspace`), Confirmation Dialogs.
- `docs/list.md`, `docs/task.md`, `docs/views.md`, `docs/pinned-tasks.md`, `docs/search-and-filters.md`.
- **Every fix ships a bug + solution doc pair in `docs/bugs/`** (today = 2026-07-24).

---

## Items

### #2 — Bulk action can't unpin tasks
**Reported:** Selecting pinned tasks via the checkbox bulk-select and choosing unpin does nothing (see screenshot — PINNED group with checkbox selected).
**Where:** `list-view.tsx` / `list-container.tsx` — the bulk-action bar and its pin/unpin handler.
**Likely cause:** the bulk handler either doesn't offer unpin, targets only the pin direction, or doesn't fire for already-pinned tasks. Inspect the selected-tasks → action mapping.
**Do:** Make bulk unpin work for selected pinned tasks (and bulk pin for unpinned). Call `refreshWorkspace` after. Consider `toastWithUndo` for consistency with other reversible list actions.
**Acceptance:** Select pinned tasks → bulk Unpin removes them from the PINNED group and updates instantly; bulk Pin still works.

### #3 — Setting a due date in list quick-edit writes BOTH start and end date
**Reported:** Setting "due date" from the list-view inline editor sets **both** `startDate` and `endDate`. Expected: either save **only the end date**, or provide **both** start and end inputs explicitly.
**Where:** `components/task/quick-task-meta.tsx` (inline date editor) → the task-update action.
**Decision needed (post it for Agents A & C):** pick one —
  1. **Due date = end date only** (recommended, matches the "Set date" single-field affordance), leaving `startDate` untouched; **or**
  2. Provide a **range picker** (start + end) in the quick editor.
Recommended: option 1 — a single "due date" writes `endDate` only. Do not silently mirror it into `startDate`.
**Do:** Fix the inline date handler so a single due-date pick writes only `endDate`. Use shadcn Calendar/DatePicker (no native date input). `refreshWorkspace` after.
**Acceptance:** Picking a due date in the list sets only the intended field; existing start dates are preserved; behavior matches on Board (coordinate with C).

### #4 — Inline edit affordance for task title
**Reported (suggestion):** Add an inline edit control to rename a task title directly from the row, instead of opening the task.
**Where:** `components/task/task-list-row.tsx`.
**Do:** Add an inline-edit interaction on the title (e.g. click/tap a pencil affordance or double-click to turn the title into an inline input). On commit, call the rename action + `refreshWorkspace`; Esc cancels, Enter/blur commits. Keep it keyboard accessible and consistent with the row's hover affordances.
**Acceptance:** User can rename a task from the list row without opening it; empty title is rejected; change reflects everywhere via realtime.

### #5 — Sorting should be clickable column headers with asc/desc indicators
**Reported:** The current Sort dropdown makes it unclear whether sort is ascending or descending. Move sorting onto the **table column headers** with a visible asc/desc arrow (ClickUp/table-style).
**Where:** Sort state currently in `components/list/list-filter-toolbar.tsx`; column headers rendered in `list-view.tsx`.
**Do:** Make sortable column headers (Name, Due date, Priority, etc.) clickable: click cycles asc → desc → (optionally none), with an arrow indicator on the active column. Keep the existing sort state source of truth; the dropdown can remain or be removed — confirm with product, but at minimum the headers must reflect and control sort direction visibly.
**Acceptance:** Clicking a column header sorts by it and shows a clear asc/desc arrow; direction is never ambiguous; grouping still works.

---

## Definition of done (all items)
- shadcn only; `rounded-xl` surfaces, `rounded-md` buttons/inputs; no native date/select/checkbox inputs.
- All mutations call `refreshWorkspace`.
- Verify in the browser: pinned group, inline date, inline rename, sortable headers — including edge cases (empty title, preserving start date).
- Ship the `docs/bugs/` bug+solution pair for the bug fixes (#2, #3). #4 and #5 are enhancements — still document notably if they change shared behavior.
- **Post your #3 start/end-date decision** so Agents A and C converge on the same semantics.
