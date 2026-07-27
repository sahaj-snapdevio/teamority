# Views

## Overview

Views are different ways to visualize and interact with tasks. The same underlying tasks can be seen in multiple views — switching view does not change the data, only how it is displayed.

**Switching your view does not affect what other members see** — it's local UI state, not a shared setting. It is also not remembered: reloading the page or navigating back into a List resets to List View unless the URL still carries `?view=board`/`?view=calendar` (see [View & Preference Persistence](#view--preference-persistence) below for exactly what is and isn't remembered).

**MVP Views:**
| View | Scope | Description |
|------|-------|-------------|
| List View | Per List | Default row-by-row task list |
| Board View | Per List | Kanban columns grouped by status |
| Calendar View | Per List | Tasks placed on a calendar by due date |
| My Tasks | Global (workspace-wide) | Personal view of all tasks assigned to the current user |

---

## 1. List View

The default view for every List. Tasks are displayed as rows with key fields visible inline.

### Layout

```
[ ] Task Title          | Assignee | Due Date | Priority | Status
[ ] Another Task        | Assignee | Due Date | Priority | Status
  [ ] Subtask           | Assignee | Due Date |          | Status
+ Add Task
```

### Features

**Columns visible inline (configurable per user):**
- Task Title (always visible, cannot hide)
- Status
- Priority
- Assignee(s)
- Due Date
- Tags
- Story Points (if sprint is active)

**Column customization:**
- Show / hide columns per user preference
- Reorder columns (drag-and-drop) per user preference
- Column preferences are saved per user per List

**Task rows:**
- Click a task row to open the Task detail panel
- Inline edit: click a field directly in the row to edit (status, priority, due date, assignee) without opening the detail panel
- **Inline rename:** the task title is editable in place — double-click the
  title, or use the pencil button that appears beside it on row hover (also
  reachable from the row's ⋯ menu → Rename). Enter or blur commits, Esc
  cancels, and an empty title is rejected with a toast rather than saved.
  Focus returns to the row afterwards so keyboard navigation keeps its place.
  - This lives in the shared `components/task/task-list-row.tsx`, so it appears
    anywhere that component is rendered — List view (including the Pinned
    section) and Sprint view.
  - Gated on `canEdit`; viewers see neither the pencil nor the double-click
    behavior.
- Subtasks shown as indented rows under their parent — collapsible per user
- Completed tasks (closed status) shown with strikethrough — can be hidden via toggle `Hide Closed Tasks`

**Grouping:**
- Default: no grouping (flat list ordered by `order_index`)
- Group by: Status / Priority / Assignee / Due Date / Tags
- When grouped, tasks are split into collapsible sections per group value

**Quick create:**
- `+ Add Task` button at the bottom of the list (or bottom of each group when grouped)
- Type title → Enter → task created instantly in that group's context (e.g. creating in the "High Priority" group sets priority to High)

**Bulk selection:**
- Each task row has a checkbox on the far left — hidden by default, appears on row hover
- Checking any task reveals all other checkboxes and activates the **Bulk Action Bar** at the bottom of the screen
- `Shift+Click` a checkbox — range-selects all tasks between the last selected and the clicked row
- Checkbox in the column header — selects / deselects all currently visible tasks (respects active filters and grouping)
- Selection is cleared when: navigating away, switching views, or clicking `✕ Clear` in the Bulk Action Bar

**Bulk Action Bar** (appears at bottom of screen when ≥1 task is selected):
```
[✓ 5 selected]  [Assign]  [Status]  [Priority]  [Move]  [Archive]  [Delete]  [✕ Clear]
```

| Bulk Action | Behavior | Required Permission |
|-------------|----------|-------------------|
| Assign | Opens user picker — replaces all assignees on every selected task | Edit / Full Access |
| Status | Dropdown of the current List's statuses — applies to all selected tasks | Edit / Full Access |
| Priority | Dropdown (None/Low/Medium/High/Urgent) — applies to all selected tasks | Edit / Full Access |
| Move | List picker (all accessible Lists in the workspace) — moves all selected tasks | Full Access / Admin+ |
| Archive | Archives all selected tasks in one action — removes from view | Full Access / Admin+ |
| Delete | Confirmation modal: `"Delete 5 tasks? This cannot be undone."` — permanently deletes all selected | Full Access / Admin+ |

**Bulk action rules:**
- If selected tasks span different statuses and the user applies a status — all tasks move to the new status regardless of their current status
- Moving tasks to a different List: status is remapped to the closest match by name (same rule as single task move)
- Archived tasks are excluded from the selectable rows by default (unless `Show Archived` filter is active)
- Activity log entry is created per task for each bulk action — not a single grouped entry

**"Close All Tasks" list action:**

Available from the List toolbar (`···` overflow menu → `Close All Tasks`):

```
List toolbar:  [ List ][ Board ]  [+ Add Task]  [ Filter ]  [ ··· ▾ ]
                                                                          └─ Close All Tasks
                                                                          └─ Archive All Closed Tasks
```

- **Close All Tasks** — sets every open task in the List (or current filtered view) to the List's `closed`-type status in one action
  - A confirmation dialog appears: `"Close all 24 open tasks in this List? This will mark them as [Done]."` with `[Close All]` and `[Cancel]` buttons
  - If filters are active, only the currently visible tasks are affected — the dialog clearly states this: `"Close 8 filtered tasks"`
  - Each affected task gets an Activity Log entry: `"[User] marked task as Done via Close All"`
  - Completed tasks (already closed) are skipped silently
  - Required permission: **Full Access / Admin+**

- **Archive All Closed Tasks** — archives every task in the List that is already in a `closed` status
  - Confirmation dialog: `"Archive all 18 completed tasks? They will be hidden from the List view."`
  - Useful after using "Close All Tasks" to clean up the view
  - Required permission: **Full Access / Admin+**

**Sorting:**
- Manual sort (drag-and-drop to reorder)
- Sort by: Due Date / Priority / Status / Assignee / Created Date / Last Updated
- Sort is per user — does not affect others
- **Sorting is driven from the column headers.** Name, Due Date and Priority are
  clickable headers that cycle `inactive → ascending → descending → off`, with a
  caret on the active column showing the direction. Direction must never be
  ambiguous — a sort control that names the column but not the direction is the
  bug this replaced.
  - Assignee is intentionally **not** sortable: with multi-assignee tasks there
    is no single well-defined order, so it stays a plain label rather than a
    header that appears clickable and does nothing.
  - The toolbar **Sort** dropdown is kept and now shows the direction too. It is
    not redundant — the header row is desktop-only (`hidden md:flex`), so the
    dropdown is the only sort control on mobile. Both drive the same state.
  - Picking a *different* column always restarts at ascending rather than
    inheriting the previous column's direction.
  - Undated tasks sort **last in both directions** when sorting by Due Date.
    Reversing them to the top would bury every dated task behind a wall of
    blanks.
  - Due Date sorting reads `dueDateEnd` — the same field the Due Date column
    displays and the inline editor writes (see
    `docs/bugs/2026-07-24-solution-list-due-date-writes-both-start-and-end.md`).

**Filters:**
- All filters from the Filter & Sort module apply here
- Active filters shown as chips in the view toolbar

---

## 2. Board View

A Kanban board where tasks are displayed as cards in columns, one column per status.

### Layout

```
┌──────────┐  ┌─────────────┐  ┌──────────┐  ┌──────────┐
│   Todo   │  │ In Progress │  │  Review  │  │   Done   │
├──────────┤  ├─────────────┤  ├──────────┤  ├──────────┤
│ Task A   │  │ Task C      │  │ Task E   │  │ Task F   │
│ Task B   │  │ Task D      │  │          │  │ Task G   │
│          │  │             │  │          │  │          │
│+ Add     │  │+ Add        │  │+ Add     │  │+ Add     │
└──────────┘  └─────────────┘  └──────────┘  └──────────┘
```

### Features

**Columns:**
- One column per status in the List
- Column order matches the status order defined in List settings
- Column header shows status name + task count in that column
- Columns cannot be added/removed from Board View — manage statuses from List settings

**Task cards show:**
- Task title
- Priority badge (colored)
- Assignee avatar(s)
- Due date (red if overdue)
- Subtask count fraction (e.g. `2/5`) if subtasks exist
- Checklist progress fraction if checklists exist
- Tag chips

**Drag and drop:**
- Drag a task card from one column to another to change its status
- Drag within a column to reorder tasks
- Reorder is global — affects all users

**Quick create:**
- `+ Add` button at the bottom of each column
- Creates a task with the column's status pre-set

**Sprint mode:**
- When a Sprint is Active, Board View shows only tasks in the active sprint
- A toggle `Show Backlog` reveals backlog tasks in a separate swimlane at the bottom

**Filters and sort:**
- Same filter options as List View apply to Board View
- Sort within columns: by Due Date / Priority / Created Date

---

## 3. My Tasks View

A personal, workspace-wide view showing all tasks and subtasks assigned to the currently logged-in user, across all Spaces and Lists they have access to.

**Scope:** Entire Workspace — not limited to a single List or Space.

### Layout

```
My Tasks
├── Overdue (3)
│     └── Fix login bug         · Engineering › Backlog    · Due 2 days ago
├── Due Today (2)
│     └── Review PR             · Engineering › Sprint 12  · Due today
│     └── Send weekly report    · Marketing › Tasks        · Due today
├── Due This Week (5)
│     └── ...
├── Upcoming (12)
│     └── ...
└── No Due Date (8)
      └── ...
```

### Features

**Grouping (default — by due date proximity):**
- Overdue — past due date, not closed
- Due Today
- Due This Week (excluding today)
- Upcoming (beyond this week)
- No Due Date

**Alternative grouping options (user can switch):**
- By Space
- By List
- By Priority
- By Status

**Each task row shows:**
- Task title
- Space name + List name (context breadcrumb)
- Due date
- Priority badge
- Status pill
- If subtask: parent task name shown in smaller text below

**Actions available inline:**
- Change status
- Change due date
- Open Task detail panel (click title)

**Bulk selection in My Tasks:**
- Same checkbox + Shift+Click selection model as List View
- Bulk actions available: **Assign**, **Status**, **Priority**, **Archive**
- **Move** and **Delete** are not available in My Tasks bulk actions — tasks here span multiple Lists, making bulk move/delete too destructive without clear context
- Status dropdown in My Tasks bulk action shows a merged list of statuses — if selected tasks are from different Lists, only statuses that exist by name across all of them are shown. If none match, the action is disabled with a tooltip: `"Selected tasks have incompatible statuses — apply status from within a single List"`

**Filters:**
- Filter by Space (show tasks from specific spaces only)
- Filter by Priority
- Filter by Status
- Toggle: `Show Completed` (hide closed tasks by default)

**Sorting:**
- Default: by due date (soonest first)
- Sort by: Priority / Status / List / Space / Created Date

**Access:**
- Available to every workspace member from the left sidebar (global nav)
- Always shows only tasks assigned to the current user — cannot view other users' My Tasks

---

## View Switcher

Every List has a view switcher in the toolbar (top of the List page):

```
[ List ] [ Board ] [ Calendar ]
```

- Clicking a view tab switches to that view instantly (client-side, no reload)
- The selected tab is **not** remembered — it resets to List View on the next visit unless the URL explicitly carries `?view=board` or `?view=calendar` (see [View & Preference Persistence](#view--preference-persistence))
- My Tasks is accessible from the global left sidebar, not the List toolbar

---

## View & Preference Persistence

There is no `UserListViewPreference` or `UserMyTasksPreference` table — no such table exists in `db/schema/`. Every view/preference is either plain client-side `localStorage`, or not persisted at all:

| What | Mechanism | Scope | Persisted across visits? |
|---|---|---|---|
| Active view tab (List/Board/Calendar) | React state seeded once from the `?view=` URL query param, default `list` (`list-container.tsx`) | Current page load only | **No** — resets to List unless the URL carries `?view=` |
| List View sort / group-by / filters | `localStorage` key `kanbanica:list-view:{listId}` — JSON blob of `sortBy`, `sortOrder`, `groupBy`, `priorityFilter`, `assigneeFilter`, `statusFilter`, `customFieldFilters` (`list-view.tsx`) | Per list, per browser | Yes |
| List View column visibility | `localStorage` key `kanbanica:list-columns:{listId}` via `useListColumnPreferences` (`hooks/use-list-column-preferences.ts`) | Per list, per browser | Yes — **custom fields only**; built-in columns (Priority, Due Date, Assignee, Tags) aren't toggleable yet, see the code comment in `list-view.tsx`'s Columns menu |
| Archived section expanded/collapsed | `localStorage` key `kanbanica:list-archived:{listId}` (`list-container.tsx`) | Per list, per browser | Yes |
| Calendar's displayed month | `localStorage` key `kanbanica:calendar-month:{listId}` (`calendar-view.tsx`) | Per list, per browser | Yes |
| My Tasks group-by / show-completed | Plain `React.useState`, default `"due_date"` / `false` (`components/my-tasks/my-tasks-view.tsx`) | Current page load only | **No** — resets on every visit |

Practical consequences: nothing here syncs across devices or browsers (it's `localStorage`, not server state), there's no account/settings UI that surfaces or resets these values, and the active List/Board/Calendar tab itself is the one thing that doesn't even survive a reload on the same device. A server-backed preferences table is a reasonable future addition but isn't built today — treat any earlier draft of this document describing one as aspirational, not current.

---

## How view data actually loads and mutates

There is no versioned REST API for views — Kanbanica reads and writes through Next.js Server Components and Server Actions, not a separate `/api/*` surface, for almost everything below:

| Operation | How it actually works | Where |
|---|---|---|
| Load List/Board tasks | The List page (`page.tsx`) is a Server Component — it queries Drizzle directly and passes the result as props to `<ListContainer>`. No client-side fetch, no `/api/lists/:listId/tasks` route. | `app/(app)/[workspaceId]/[spaceId]/list/[listId]/page.tsx` |
| Load My Tasks | `getMyTasks()` Server Action — cross-workspace, called directly from `MyTasksView`. | `app/actions/my-tasks.ts` |
| Bulk status change / delete / archive / move | Four separate Server Actions, not one generic "bulk" endpoint: `bulkUpdateStatus`, `bulkDeleteTasks`, `bulkArchiveTasks`, `bulkMoveTasks`. | `app/actions/task.ts` |
| Archive / unarchive a List | `archiveList` / `unarchiveList` Server Actions. | `app/actions/list.ts` |
| Mark all incomplete sprint tasks done / close a sprint | `markAllSprintTasksDone` / `closeSprint` Server Actions. | `app/actions/sprint.ts` |
| Pinned-task reordering | The one real REST route in this area: `PATCH /api/lists/[listId]/pinned-tasks/reorder`. | `app/api/lists/[listId]/pinned-tasks/reorder/route.ts` |

**"Close All Tasks" and "Archive All Closed Tasks" as dedicated toolbar actions (referenced in earlier drafts of the Business Rules below) were not found anywhere in the codebase** — no matching Server Action, API route, or UI copy exists. If these are still wanted, they need to be built, not just re-documented; this doc no longer claims they exist.

---

## UI Screens

| Screen | Route | Access |
|--------|-------|--------|
| List View | `/[workspaceId]/[spaceId]/list/[listId]` (default; `?view=list` also works) | Space member |
| Board View | `/[workspaceId]/[spaceId]/list/[listId]?view=board` | Space member |
| Calendar View | `/[workspaceId]/[spaceId]/list/[listId]?view=calendar` | Space member |
| My Tasks | `/[workspaceId]/my-tasks` | All workspace members |

---

## Business Rules

1. View preference is per user per List — switching view does not affect other members.
2. All views display the same tasks — the data is identical, only the presentation changes.
3. Filters applied in one view carry over when switching to another view on the same List.
4. Drag-and-drop status changes in Board View are global — they change the task's actual status for everyone.
5. Drag-and-drop reordering within a column in Board View is global — order is shared.
6. My Tasks shows tasks across all Spaces the user has access to — if access is revoked from a Space, those tasks disappear from My Tasks immediately.
7. Closed tasks are hidden by default in My Tasks — user can toggle `Show Completed` to see them.
8. Column visibility and order in List View are per user — they are not shared with other members.
9. View switcher is only available at the List level — My Tasks is a global view accessible from the sidebar.
10. Bulk selection is only available in List View and My Tasks — not in Board View.
12. Bulk actions are applied server-side atomically per task — if one task fails a permission check, that task is skipped and the others still apply. The result message shows how many succeeded and how many were skipped.
13. Each task in a bulk action generates its own Activity Log entry — bulk actions do not create a single grouped log.
14. Bulk delete requires an explicit confirmation modal showing the exact count — no undo.
15. "Close All Tasks" and "Archive All Closed Tasks" are **not currently implemented** — no matching Server Action, API route, or UI control exists (verified against `app/actions/task.ts`, `app/actions/list.ts`, and the List View toolbar). This bullet describes the originally-planned behavior (respecting active filters, a confirmation dialog stating the exact count) for if/when it's built — see [How view data actually loads and mutates](#how-view-data-actually-loads-and-mutates).
16. "Mark all as Done" inside the Close Sprint modal uses the List's `closed`-type status — if the List has multiple closed-type statuses, the first one in the status order is used.

---

## Out of Scope (MVP)

- Gantt / Timeline View
- Table / Spreadsheet View
- Workload View (capacity per member)
- Dashboard View (widgets and charts)
- Saving custom views with a name
- Sharing a saved view with the team

---

## Implementation Notes

### Board View -- SSR and dnd-kit

The original plan assumed dnd-kit accesses `window` at module load and required a `dynamic(..., { ssr: false })` wrapper to avoid crashing server render. **The shipped implementation does not do this** — `board-view.tsx` (and `calendar-view.tsx`, which also uses dnd-kit) are plain `"use client"` components, statically imported into `list-container.tsx` like any other component, with dnd-kit imported at the top of the file. This works because `@dnd-kit/core`/`@dnd-kit/sortable` (currently `^6.x` — see `package.json`) don't touch `window` at module scope; they defer any browser API access into effects that only run client-side. If you're adding a new dnd-kit-based view, follow the existing pattern (plain `"use client"` import) rather than reaching for `dynamic({ ssr: false })` — it isn't needed with the dnd-kit version this project uses.

Add a `// NOTE: ssr: false required -- dnd-kit accesses window` comment at the dynamic import to prevent future removal.

### Board View Column Order

Columns in Board View are ordered by `ListStatus.orderIndex`. This is the same `orderIndex` managed in List Settings. There is no separate Board column order -- status order is authoritative for both views.

When drag-and-drop moves a task from one column to another, `board-view.tsx`'s `onDragEnd` calls the `updateTaskStatus` Server Action (`app/actions/task.ts`) — there is no `/api/tasks/:id` REST route. Do NOT reorder columns on drag.

### `order_index` for Task Drag Reordering

Tasks within a List (and within a Board View column) use integer `order_index` for drag ordering.

**Strategy:** Use a gap of 1000 between new tasks (0, 1000, 2000, 3000...) to allow insertions without full reindex. When inserting between two tasks, use the midpoint. When the gap between adjacent tasks reaches 0, rebalance. This is the same gap/rebalance strategy used elsewhere in the app (e.g. custom field ordering, pinned-task ordering) — illustrative pseudocode below, not a literal file:

```typescript
async function reorderTask(taskId: string, afterTaskId: string | null, listId: string) {
  // Get the task before and after the new position
  const [before, after] = await getAdjacentTasks(afterTaskId, listId)

  let newIndex: number
  if (!before && !after) {
    newIndex = 1000
  } else if (!before) {
    newIndex = after!.orderIndex - 500
  } else if (!after) {
    newIndex = before.orderIndex + 1000
  } else {
    newIndex = Math.floor((before.orderIndex + after.orderIndex) / 2)
    // If gap is 0, rebalance all tasks in the list
    if (newIndex === before.orderIndex) {
      await rebalanceOrderIndexes(listId)
      return reorderTask(taskId, afterTaskId, listId)  // retry after rebalance
    }
  }

  await db.task.update({ where: { id: taskId }, data: { orderIndex: newIndex } })
}
```

### My Tasks Query

`getMyTasks(options?: { showCompleted?: boolean })` — a Server Action, not a REST route — in `app/actions/my-tasks.ts`. It's cross-workspace: for every **ACTIVE** workspace the caller belongs to, it takes the union of `getAccessibleSpaceIds()` (`lib/permissions.ts`) and returns tasks assigned to the caller within that combined set, each annotated with its `workspace`/`space`/`list`/`status`/`tags`. See [`docs/task.md`](./task.md) and the `MyTask`/`MyTasksGroupBy` types in `app/actions/my-tasks.ts` for the full shape.

### Folder Mapping

```
app/(app)/[workspaceId]/[spaceId]/list/[listId]/
  page.tsx                        <- Server Component: queries Drizzle directly, passes tasks as props
  _components/
    list-container.tsx            <- view switcher (List/Board/Calendar tabs)
    list-view.tsx                 <- List View, incl. sort/group/filter/column UI
    board-view.tsx                <- Board View ("use client", dnd-kit)
    calendar-view.tsx             <- Calendar View
components/my-tasks/
  my-tasks-view.tsx                <- global My Tasks view
hooks/
  use-list-column-preferences.ts  <- localStorage-backed column visibility (custom fields only)
app/actions/
  my-tasks.ts                     <- getMyTasks()
  task.ts                         <- bulkUpdateStatus, bulkDeleteTasks, bulkArchiveTasks, bulkMoveTasks, updateTaskStatus, archiveTask, unarchiveTask, ...
  list.ts                         <- archiveList, unarchiveList
  sprint.ts                       <- markAllSprintTasksDone, closeSprint
app/api/lists/[listId]/pinned-tasks/reorder/
  route.ts                        <- the one real REST route in this area
```

No `app/api/me/*`, `app/api/lists/[listId]/{close-all,archive-closed}`, or `app/api/tasks/bulk` routes exist — those were part of the original planning spec and were never built; the actual functionality (where it exists at all — see the caveat on "Close All"/"Archive All Closed" above) lives in the Server Actions listed above instead.
