# Workspace Overview

A read-only, workspace-wide analytics dashboard. It summarizes progress across every
project, list, and sprint the current user can see in the workspace — not just the
list or project currently open.

## Navigation

Reached from the workspace sidebar: **Overview → My Tasks → Inbox → Projects**.
Route: `/[workspaceId]/overview` (`app/(app)/[workspaceId]/overview/page.tsx`).

This is additive — the existing workspace-root redirect (`/[workspaceId]` →
first accessible list, or onboarding/empty-state per `lib/workspace-landing.ts`)
is unchanged.

## Data source

`getWorkspaceOverview(workspaceId)` in `app/actions/workspace-overview.ts` — one
server action, called client-side on mount by `WorkspaceOverviewView`
(`components/workspace-overview/workspace-overview-view.tsx`) and re-fetched on
realtime `data_changed` events (`useRealtimeRefetch`).

Every query is scoped through `getAccessibleSpaceIds(userId, workspaceId)`
(`lib/permissions.ts`) — the same permission model as My Tasks and the Space
sidebar tree. A Guest only ever sees numbers derived from spaces they're a member
of; private spaces they can't access never contribute to any total.

The whole payload is wrapped in `unstable_cache` (60s, tagged
`workspace-overview:{workspaceId}`, keyed by workspace **and** user since results
are permission-scoped). `refreshWorkspace` (`lib/realtime/refresh.ts`) — the single
choke point every mutation already calls — invalidates that tag on every write, so
the cache never serves stale data across a real change; it just avoids recomputing
the aggregate on every page visit in between.

## Widgets

Rendered top to bottom in `workspace-overview-view.tsx`:

1. **Summary Cards** — Total Tasks, Completed, In Progress, Overdue, Due Today,
   Active Projects, Active Sprints, and an Overall Completion bar (shows
   `completed / total (X%)`). Cards that correspond to a widget further down the
   page link to it. Completed, In Progress, and Overdue each carry a small trend
   line — see "Trend indicators" below.
2. **Quick Actions** — Create Task, Start Sprint, Create Project, Invite Member
   (`components/workspace-overview/quick-actions.tsx`). Every action reuses an
   existing flow rather than duplicating it: Create Task pops a project→list
   picker (`getWorkspaceLists`/`getListStatuses` from `app/actions/list.ts`, the
   same actions the task-list-row "Move to List" picker uses) then opens the
   existing `CreateTaskModal`; Start Sprint reuses the exact `getSprintSettings`
   gate `workspace-shell.tsx` already has (redirects to Sprint Settings if a
   project hasn't configured sprints yet, otherwise opens `CreateSprintModal`);
   Create Project and Invite Member just open `CreateSpaceModal` /
   `InviteMemberModal` directly. No new create/invite logic was written.
3. **Task Status Breakdown** — donut chart over 4 fixed **dashboard categories**
   (`listStatus.dashboardCategory`: `OPEN`/`WORKING`/`REVIEW`/`COMPLETED`, labeled
   Todo/Working/Review/Completed). This is independent of both the status *name*
   and `listStatus.type` (the enum that drives Board/List column grouping) —
   every status, default or custom, is tagged with a dashboard category at
   creation (defaults to Todo/`OPEN` if unset) and can be recategorized any time
   from the list's status settings, without changing its name, color, or board
   position. See "Dashboard categories" below.
4. **Priority Breakdown** — bar list over the 5 `task.priority` values, reusing
   `PRIORITY_CONFIG` (`lib/priority-config.ts`) for icon/color/label so it matches
   priority badges everywhere else in the app.
5. **Projects** — a mini-card per accessible non-archived project: name, a
   Tasks / Completed / Overdue (only shown when > 0) stat row, and a completed-%
   progress bar. The whole card links to the project.
6. **Team Workload** — one row per active workspace member, clickable end to
   end (opens `TaskDrilldownSheet` — see "Drill-downs" below — filtered to
   every task, any status, assigned to that member).
   - A 🟢 Light / 🟡 Medium / 🔴 Heavy badge next to the name, from
     `getWorkloadLevel()` (`lib/workload-config.ts`) over the member's
     **active** (dashboard category ≠ `COMPLETED`) assigned task count. Thresholds
     (`WORKLOAD_THRESHOLDS`: 0–5 / 6–10 / 11+) live in that one file so
     they're easy to retune without touching the widget.
   - The bar represents **completion**, not raw load:
     `completedCount / assignedCount` (both counts include every status, so
     this reads as "how much of what's on their plate is done"), captioned
     `{completed} / {assigned} completed`. Fill color is a 4-tier ramp on
     that percentage (`completionBarColor()` in `assignee-workload.tsx`):
     green &lt;50%, yellow 50–80%, orange 80–100%, and red only at 100%
     *for a Heavy-workload member* — 100% completion is good news for anyone
     else, so red is reserved for "cleared a big stack, expect the next one
     imminently," not "done."
   - Also shows **Average age** — the mean age in days (`today -
     task.createdAt`, calendar days) of that member's currently *open*
     (dashboard category ≠ `COMPLETED`) assigned tasks, surfacing whose queue is
     going stale rather than just who has the most tasks. Omitted when the
     member has zero open assigned tasks (no misleading "0d").
7. **Upcoming Deadlines** — 🔴 Overdue / 🟡 Today / 🟢 Tomorrow / 🔵 Next 7 Days,
   mutually exclusive buckets (a task appears in exactly one). Tasks whose
   dashboard category is `COMPLETED` are excluded. Effective due date is
   `dueDateEnd ?? dueDateStart` (same fallback
   `my-tasks-view.tsx` uses for display — not the stricter dueDateEnd-only rule
   the task detail editor uses when writing). Sorted by urgency: due date
   ascending (oldest-overdue / soonest-due first), then priority descending —
   `sortByUrgency` in `app/actions/workspace-overview.ts`, shared with the
   drill-down below so ordering matches everywhere.

   Each section shows at most 3 tasks (`DEADLINE_PREVIEW_CAP`) so the card's
   height never depends on how many tasks a workspace has — a `+N more` link
   below the preview (and a "View All" action in the card header, for the union
   of all 4 buckets) opens `TaskDrilldownSheet` with the full, unpaginated list.
   `getWorkspaceOverview` still returns each bucket's true `total` alongside the
   3-item `tasks` preview so the section header count and "+N more" are always
   accurate, not just "however many fit."
8. **Recent Activity** — reuses the `activityLog` system (`lib/activity-log.ts`,
   `describeEvent` from `lib/activity-descriptions.ts`, shared with
   `SpaceActivityFeed` and `TaskActivityFeed`), scoped workspace-wide instead of to
   one space. Last 30 days, capped at 20 rows, no pagination. Grouped client-side
   into Today / Yesterday / Last 7 Days / Earlier headers — no backend change.
9. **Sprint Overview** — a card per sprint with `status = 'ACTIVE'` across every
   accessible project (a workspace can have more than one active sprint at once,
   one per project). Progress, completed/remaining, days remaining. **The entire
   widget is omitted when there are zero active sprints** — not shown empty.

Every other widget shows a friendly inline empty state ("No overdue tasks 🎉",
"No activity in the last 30 days", …) rather than being hidden, so the page never
looks broken for a new project. Only two things replace the whole page: zero
accessible non-archived projects shows one full-page empty state instead of 8 empty
widgets.

### Drill-downs

`components/workspace-overview/task-drilldown-sheet.tsx` is a single shared side
sheet used by the Status Breakdown chart (click a donut segment or legend
row), Upcoming Deadlines (click "+N more" or "View All"), and Team Workload
(click any member row). It takes a
`request: { kind: "status"; statusType } | { kind: "deadline"; bucket } | { kind: "assignee"; userId } | null`
descriptor rather than a callback — callers pass their own React state value
directly, so the fetch effect only re-runs when the actual selection changes,
not on every re-render the way a fresh inline closure would. Backed by three
on-demand actions (`getWorkspaceTasksByStatus`, `getWorkspaceTasksByDeadline`,
`getWorkspaceTasksByAssignee`), none part of the cached aggregate, so a
drill-down always reads fresh and is capped generously (`DRILLDOWN_LIMIT`)
rather than paginated. `getWorkspaceTasksByStatus` filters on
`listStatus.dashboardCategory`, not status name or `type`. Unlike the other
two, the assignee drill-down doesn't filter by status — it's every
non-archived task assigned to that member, so clicking a name shows their
full queue (any dashboard category), matching the bar above it which already
counts every status.

There's no dedicated workspace-wide "task list" page/route in the app today —
List/Board are per-project, and My Tasks is assigned-to-me only — so this sheet
*is* the filtered task list for MVP: same permission scoping as the rest of
Overview, click-through to any task. If a real standalone filtered-list page is
wanted later, both actions already return the right shape to back one.

### Trend indicators

`task` has no `completedAt` timestamp — status is a live pointer to a `listStatus`
row, not an event with a time. "Completed" and "In Progress" trends ("+N this
week") are derived from `activityLog` `status_changed` events in the last 7 days
whose target status resolves to dashboard category `COMPLETED` (resp. `WORKING`),
intersected with the task's *current* status also resolving to `COMPLETED`
(resp. `WORKING`) — so a task that was completed and later reopened this week
doesn't count toward "Completed", and a task that moved Working → Completed
this week counts only toward "Completed", not "In Progress".

"Overdue" is different: it's a derived state (`dueDate < today`), not something
`activityLog` ever records a transition for, so there's no event-log trick that
gives an honest "vs yesterday" delta. Instead, `workspace_overview_snapshot`
(`db/schema/workspace-overview-snapshot.ts`) stores one row per
`(workspaceId, userId, date)`, written opportunistically the first time
`getWorkspaceOverview` runs for that user on a given day (`onConflictDoNothing`,
inside the same `unstable_cache`-wrapped call — so it only actually executes on a
cache miss). The Overdue trend reads yesterday's row and diffs it against today's
live count; if no snapshot exists yet (new workspace, or the user's first day
using Overview) the trend is omitted rather than shown as `0`. **Scoped per user,
not just per workspace** — Overview's counts are already permission-scoped
(`getAccessibleSpaceIds`), so a Guest and an Owner can see different totals for
the same workspace on the same day; a single shared snapshot would produce a
misleading delta for whichever role didn't write it that day.

### Dashboard categories

`listStatus.dashboardCategory` (`db/schema/list.ts`) is a second, independent
classification alongside `listStatus.type` — `type` (`OPEN`/`ACTIVE`/`CLOSED`)
still drives Board/List column grouping and the "a list needs at least one
closed status" delete guard exactly as before; `dashboardCategory`
(`OPEN`/`WORKING`/`REVIEW`/`COMPLETED`) exists solely so Overview analytics can
aggregate consistently across any set of custom status names. Every status —
default or user-created — carries a value, defaulting to `OPEN` ("Todo") if
none is chosen. It's set/edited everywhere a status can be created or edited —
the dedicated list settings page and "Manage Statuses" dialog
(`components/list/list-statuses-settings.tsx`), the Board's "Add group"
dialog, and the List view's "New Status" dialog (`board-view.tsx` /
`list-view.tsx`) — all sharing the same options (`DASHBOARD_CATEGORY_OPTIONS`
in `lib/dashboard-category.ts`) and calling `createListStatus` /
`updateListStatus` (`app/actions/list.ts`). It never changes a status's name,
color, board position, or `type`.

Existing statuses were backfilled once, in migration `0023_wealthy_johnny_blaze.sql`,
by priority: (1) `type` (`OPEN`→`OPEN`, `ACTIVE`→`WORKING`, `CLOSED`→`COMPLETED`),
then (2) a name-based override for conventionally-named review statuses
(`review`/`qa`/`testing`/`uat` → `REVIEW`), with `OPEN` as the final default for
anything unmatched. That migration is a one-time backfill — it never re-runs,
so a later manual recategorization is never overwritten by it.

## Formulas

- `completionPercent = round(completed / total * 100)`, 0 if total is 0 — same
  shape as the sprint-progress formula in `docs/sprint.md`.
- "Active Projects" = `accessibleSpaceIds.length` (already excludes archived).
- Sprint days remaining = `differenceInCalendarDays(endDate, today)`, floored at 0.

## Charts

No charting library is used — both charts are hand-rolled SVG/CSS
(`components/workspace-overview/charts/`), consistent with the rest of the app
(no chart dependency existed before this feature). Status colors reuse the
app's reserved semantic tokens for Todo/Working/Completed
(`--muted-foreground`/`--info`/`--success`) plus a purple accent for Review,
matching "Waiting for Review" in My Focus Today; priority colors reuse
`PRIORITY_CONFIG`. Isolated in their own `charts/` subfolder so a future swap
to a real charting library doesn't touch the surrounding widgets.

## Out of scope (do NOT build)

Burn-down charts, velocity charts, cycle time / lead time, story point analytics,
AI insights, custom dashboards, exportable reports, Gantt charts, financial/billing
analytics, time-tracking analytics, custom-field analytics, team productivity
scoring.
