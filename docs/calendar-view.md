# Calendar View

## Goal

Provide a date-grid visualization of tasks within a List, allowing users to see task due dates spatially and drag tasks to reschedule them.

**Status: shipped.** Calendar View is implemented as one of the List view-switcher tabs (alongside List/Board) — see `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/calendar-view.tsx`, wired in via `list-container.tsx` in the same directory. The sections below describe the original design; some implementation details (folder layout, exact API shape) have since diverged from the plan as written — treat the source as ground truth for specifics, and this doc for the intended user flow and business rules.

---

## User Flow

1. User opens a List -> clicks "Calendar" in the view switcher (alongside List/Board)
2. Calendar renders in monthly view by default; weekly toggle available
3. Each task with a `dueDateEnd` appears as a chip on its due date
4. Tasks without a due date appear in an "Unscheduled" sidebar on the right
5. User drags a task chip to a new date -> `dueDateEnd` is updated via `PATCH /api/tasks/:id`
6. User drags a task from the Unscheduled sidebar to the grid -> sets `dueDateEnd`
7. Clicking a task chip opens the Task detail panel (same as List/Board view)
8. Calendar respects all existing task filters (assignee, priority, status)

---

## Technical Design

### Client rendering

`CalendarView` and `BoardView` (`app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/calendar-view.tsx` / `board-view.tsx`) are plain `"use client"` components using dnd-kit directly, statically imported into `list-container.tsx` — no `dynamic(..., { ssr: false })` wrapper is used or needed. An earlier draft of this doc assumed dnd-kit would crash on SSR and required that wrapper; that assumption didn't hold in practice for the dnd-kit/Next.js versions actually used, and the shipped code works without it.

### Date Handling

- All dates stored in UTC (Drizzle `timestamp({ withTimezone: true })` -> PostgreSQL `TIMESTAMP WITH TIME ZONE`)
- Calendar grid renders in the user's local timezone using `Intl.DateTimeFormat`
- Use `date-fns` for grid generation (month/week date arithmetic)
- Drag-to-reschedule sends the target date in ISO format; client must convert local date -> UTC before sending
- Never store timezone in the task -- always UTC, always convert on display

### Timezone Edge Cases

- A task due "June 10" for a user in UTC-5 is stored as `2026-06-10T05:00:00Z`
- On render, convert stored UTC back to local date for grid placement
- If the user changes their system timezone, task dates shift visually (expected behavior)

### Library Choice

- Build a lightweight custom grid with `date-fns` -- avoid `react-big-calendar` for monthly/weekly-only views (carries significant bundle weight)
- Use dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) for drag-and-drop

---

## Folder Mapping

Actual layout (differs from the original plan, which proposed a separate `/calendar` route and a split `components/calendar/` folder):

```
app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/
  calendar-view.tsx        <- the view, rendered as a tab inside list-container.tsx
  calendar-view-mobile.tsx <- mobile-specific rendering, used from calendar-view.tsx
  list-container.tsx       <- view switcher (List / Board / Calendar)
```

---

## API

No new API endpoints. Calendar View reuses existing task endpoints:

- `GET /api/lists/:id/tasks` -- with `view=calendar` query param to include tasks without `dueDateEnd` in unscheduled list
- `PATCH /api/tasks/:id` -- to update `dueDateEnd` on drag

---

## Database

No new tables. Calendar View reads and writes `Task.dueDateEnd` (and optionally `Task.dueDateStart` for date-range tasks).

`UserListViewPreference.view` includes `calendar` as a valid value alongside `list` and `board`.

---

## Events

No new activity log events. Dragging to reschedule triggers the existing `task.due_date_changed` event in `ActivityLog`.

---

## Background Jobs

None.

---

## Dependencies

- `Task.dueDateEnd` (nullable) -- in schema
- `UserListViewPreference` table -- in schema
- dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`, plus `@dnd-kit/modifiers`/`@dnd-kit/utilities`) -- in `package.json`
- `date-fns` -- in `package.json`

---

## Edge Cases

| Scenario | Handling |
|----------|---------|
| Task with `dueDateStart` and `dueDateEnd` on different days | Render as multi-day span chip across cells |
| Task with only `dueDateStart` | Show on start date; no end indicator |
| Task with no due date at all | Place in unscheduled sidebar |
| Month with 5+ weeks | Grid must accommodate 6-row months |
| Dragging to past date | Allow -- no validation on date direction |
| 100+ tasks on one date | Show first 3 chips + overflow count; click overflow to expand |

---

## Acceptance Criteria

*(Original design checklist -- not re-verified against the shipped implementation item-by-item; see the component source for current behavior.)*

- [ ] Calendar renders all tasks with `dueDateEnd` on the correct date cell
- [ ] Dragging a task chip to a new cell updates `dueDateEnd` with optimistic update
- [ ] Dragging from unscheduled sidebar sets `dueDateEnd`
- [ ] Calendar respects active list filters
- [ ] Weekly/monthly toggle persists to `UserListViewPreference`

---

## Implementation Notes

- `calendar` is a valid `UserListViewPreference.view` value alongside `list` and `board`.
