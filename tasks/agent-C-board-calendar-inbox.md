# Agent C — Board View, Calendar & Inbox

**Scope owner:** the Board view, the Calendar view, and the Inbox (notifications) list.
**Files you own (safe to edit freely):**
- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/board-view.tsx`
- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/calendar-view.tsx`
- `components/task/create-task-modal.tsx` (board "create task" pickers — verify which composer the board uses; may be `quick-create-task.tsx`)
- `app/(app)/[workspaceId]/notifications/page.tsx`
- `app/(app)/[workspaceId]/notifications/layout.tsx`
- `components/notifications/notification-bell.tsx`, `components/notifications/notification-panel.tsx`

**Coordinate before touching (owned by other agents):**
- **Task update / assignee / due-date actions** are shared with Agent B (List) and Agent A (detail). For #16 you fix the **commit timing in the board dropdown UI**, not the underlying action. For any due-date behavior, follow **Agent B's #3 decision** (single due date = end date only).
- `quick-create-task.tsx` is listed under Agent B — if the board reuses it for #17, ping B before editing; prefer fixing the board's own composer.
- The **duplicate-task** flow (mentioned in #16) may also be triggered from List — keep the fix in shared logic minimal and coordinate.

---

## Read first
- `CLAUDE.md` (root) — UI Consistency, shadcn-only, Real-time Sync (`refreshWorkspace`), Notifications section (unread/inbox behavior, `getNotificationTarget`).
- `docs/views.md`, `docs/task.md`, `docs/notifications.md`, `docs/search-and-filters.md`.
- **Every fix ships a bug + solution doc pair in `docs/bugs/`** (today = 2026-07-24).

---

## Items

### #9 — Restrict creating a board group with a duplicate name
**Reported:** Board "Add group" allows two groups with the same name (screenshot shows duplicate "HELLO" columns). Block duplicates.
**Where:** `board-view.tsx` add-group / rename-group handler and its server action.
**Do:** Validate uniqueness (case-insensitive, trimmed) before create/rename; show an inline error/toast and prevent the mutation on collision. Enforce server-side too (don't rely on client validation alone).
**Acceptance:** Creating or renaming a group to an existing name is rejected with a clear message; unique names still work.

### #11 — Calendar view has extra top padding
**Reported:** The calendar view toolbar/header has excess padding at the top (screenshot highlights `py-2` / stacked paddings on the sticky toolbar).
**Where:** `calendar-view.tsx` — the toolbar/header container above the calendar grid.
**Do:** Remove the redundant top padding so the calendar toolbar aligns with the List/Board toolbars. Compare spacing against `list-view.tsx` / `board-view.tsx` toolbars for consistency.
**Acceptance:** Calendar view top spacing matches the other views; no clipped/overlapping controls.

### #15 — Inbox unread count doesn't update after applying a workspace filter
**Reported:** In the Inbox, applying a workspace filter correctly filters the list, but the **Unread count** badge doesn't recompute to match the filtered set.
**Where:** `app/(app)/[workspaceId]/notifications/page.tsx` (+ `notification-bell.tsx` if it mirrors the count). Find where the unread count is derived vs. where the filter is applied.
**Do:** Make the unread count reflect the active filter scope (or clarify intended semantics — global unread vs. filtered unread). Most likely the count should recompute for the filtered workspace. Ensure it updates on filter change and via realtime.
**Acceptance:** Applying/removing a workspace filter updates the Unread count to match the visible filtered notifications.

### #16 — Board dropdowns commit only on click-outside, not on option click
**Reported:** In Board view, opening the **assignee** picker and clicking an option doesn't apply; it only applies when you click **outside**. Same bug on **task duplicate**.
**Where:** `board-view.tsx` assignee (and priority/status) inline pickers; the duplicate-task control.
**Likely cause:** the option `onClick` isn't wired to commit + close (relying on the popover's `onOpenChange`/blur to flush pending state), or an event-propagation/`stopPropagation` issue swallows the click.
**Do:** Make selecting an option commit immediately (call the update action + close the popover on click). Fix the same pattern for duplicate. Verify with shadcn Popover/Command semantics. `refreshWorkspace` after.
**Acceptance:** Clicking an assignee (and priority/status) option in Board applies it immediately and closes the picker; duplicate applies on click, not on outside-click.

### #17 — Board "create task" priority & status render as multi-select checkboxes
**Reported:** In the Board create-task composer, Priority (and Status) show checkbox-style multi-select, but a task has exactly **one** priority and **one** status. Use single-select.
**Where:** the board create-task composer (`create-task-modal.tsx` or the board's inline "Add task" — verify which the board uses).
**Do:** Replace the multi-select checkbox UI for Priority and Status with single-select (shadcn Select or single-choice radio/command). Selecting one value replaces the previous, no checkboxes.
**Acceptance:** Priority and Status in board create-task are single-select; exactly one value selectable each; created task has the chosen single values.

---

## Definition of done (all items)
- shadcn only; `rounded-xl` surfaces, `rounded-md` buttons/inputs; no native select/checkbox.
- All mutations call `refreshWorkspace`.
- Verify in the browser: board group names, board assignee/priority/status pickers, duplicate, calendar spacing, inbox count under filter.
- Follow **Agent B's #3 due-date decision** for any date behavior on the board.
- Ship the `docs/bugs/` bug+solution pair for the bug fixes (#9, #11, #15, #16, #17).
