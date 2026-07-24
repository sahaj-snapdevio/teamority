# Agent A — Task Detail, Activity Feed & Time Tracking

**Scope owner:** the task detail page, the task drawer panel, the activity/comment feed, and time tracking.
**Files you own (safe to edit freely):**
- `components/task/task-activity-feed.tsx`
- `components/task/task-time-tracking.tsx`
- `components/task/task-detail-panel.tsx` (drawer)
- `app/(app)/[workspaceId]/task/[taskId]/_components/task-detail-page.tsx`
- `app/(app)/[workspaceId]/task/[taskId]/page.tsx`
- `app/actions/time-tracking.ts`
- `lib/format-duration.ts`

**Coordinate before touching (owned by other agents):**
- `components/workspace/workspace-shell.tsx` — the topbar. Item #7 needs the topbar pin indicator to update. Another agent may not touch this, but flag any shared-state change. Prefer fixing via `refreshWorkspace` / SSE rather than editing the shell's layout.
- Pin/unpin server action is shared with Agent B (#2 bulk unpin). Do **not** change the pin action's signature/behavior — only ensure it broadcasts. Read `app/(app)/.../list/[listId]/page.tsx` and the pin action first.

---

## Read first
- `CLAUDE.md` (root) — especially: Real-time Sync (`refreshWorkspace`), Time Tracking (MVP scope + out-of-scope list), Undo Toast, Confirmation Dialogs, UI Consistency (`rounded-xl`), shadcn-only rule.
- `docs/task.md`, `docs/collaboration.md`, `docs/realtime.md`.
- **Every fix must ship a bug + solution doc pair in `docs/bugs/`** per CLAUDE.md (`{YYYY-MM-DD}-bug-*.md` + `{YYYY-MM-DD}-solution-*.md`, today = 2026-07-24).

---

## Items

### #1 — Activity/chat composer should be sticky at the bottom
**Reported:** In the task Activity panel, the comment input box scrolls with the feed. It should stay pinned to the bottom while the activity list scrolls above it.
**Where:** `components/task/task-activity-feed.tsx`. The panel is used both in the full task page and the drawer (`task-detail-panel.tsx`).
**Do:** Make the composer a sticky/flex-pinned footer of the activity panel; the activity list becomes the scroll container above it. Verify in both the full-page task view and the drawer panel — the composer must stay visible without scrolling in each.
**Acceptance:** Long activity feed scrolls; composer stays fixed at the bottom of the panel in both surfaces; no layout shift, correct radius/spacing.

### #6 — Optional note field when stopping the timer  ⚠️ SCOPE ADD — confirm before building
**Reported:** When a user stops the timer, allow them to add a note describing what they worked on.
**Status:** This is an **addition beyond the documented Time Tracking MVP** (`startTimer/stopTimer/logTime/deleteTimeEntry`, no note field). CLAUDE.md lists several out-of-scope items but not this one. **Get product sign-off before implementing**, and if approved, update the Time Tracking section notes.
**If approved:** add a nullable `note` column to `timeEntry` (`db/schema/time-tracking.ts`) + migration; thread an optional note through `stopTimer` and `logTime` in `app/actions/time-tracking.ts`; show a small optional note input on timer stop and render the note under each entry in `components/task/task-time-tracking.tsx`. Keep the live clock client-side only (never write per-second). Still call `refreshWorkspace`.
**Acceptance:** Stopping a timer optionally captures a note; note persists and displays per entry; empty note is allowed; no regression to the single-running-timer invariant.

### #7 — Pin/unpin from task detail doesn't update the topbar instantly
**Reported:** Pinning/unpinning from the **task detail page** does not update the topbar pin indicator immediately, but doing it from the **list page** does update instantly.
**Where:** Pin action invoked from `task-detail-page.tsx` (and possibly the drawer). Compare with the list-page path which already refreshes. The topbar lives in `components/workspace/workspace-shell.tsx`.
**Likely root cause:** the detail-page pin handler isn't calling `refreshWorkspace(workspaceId)` (or isn't revalidating the path the topbar reads), so the SSE `data_changed` broadcast / `router.refresh()` that the list page relies on never fires. Per CLAUDE.md: **every mutation must call `refreshWorkspace`** — never `broadcastDataChanged()` directly.
**Do:** Make the detail-page pin/unpin call the same refresh path the list page uses. Confirm the topbar re-reads pin state on refresh.
**Acceptance:** Pin/unpin from the task detail page updates the topbar indicator with no manual reload, matching list-page behavior.

### #8 — Archived task detail page should show an in-place banner, not redirect
**Reported:** Opening an archived task's detail page currently redirects to the list page. Expected (ClickUp-style, see screenshot): stay on the task detail page and show a "This task has been archived" banner with an **Unarchive** action.
**Where:** `app/(app)/[workspaceId]/task/[taskId]/page.tsx` / `task-detail-page.tsx` — find the archived-task redirect and replace it.
**Do:** Render the archived task read-only (or lightly locked) with a top banner: message + Unarchive button. Unarchive should restore and re-enable editing in place. Use `toastWithUndo` where appropriate and call `refreshWorkspace`. Match design system (`rounded-xl`, shadcn, banner styling).
**Note:** Confirm the desired behavior for a user who lacks unarchive permission (banner without the action, or still redirect?) — default to showing the banner without the Unarchive button.
**Acceptance:** Navigating to an archived task shows the banner in place (no redirect); Unarchive restores the task and updates all views via realtime.

---

## Definition of done (all items)
- shadcn components only; every surface `rounded-xl`, buttons/inputs `rounded-md`.
- All mutations call `refreshWorkspace(workspaceId, paths?)`.
- No `window.confirm` — use a shadcn `Dialog`.
- Verify in the browser (full task page **and** drawer where relevant), not just typecheck.
- Ship the `docs/bugs/` bug+solution pair for each fixed bug (#1, #7, #8). #6 also gets a doc if built.
