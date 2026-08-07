# List

## Overview

A List is the primary container for Tasks. It represents a collection of work — a backlog, a project board, a bug tracker, or any grouping of tasks that belong together.

Every task must live inside a List. A List lives directly inside a Space.

**Real-world analogy:** A List = a project board or task queue. e.g. `Backlog`, `Sprint 12`, `Bug Reports`, `Feature Requests`, `Design Review`

**Hierarchy position:**
```
Workspace
  └── Project
        ├── List       ← you are here
        │     └── Task
        └── Sprint (sibling to List — see sprint.md)
```

---

## User Stories

- As a Member with Full Access, I want to create a List inside my Space so I can group related tasks together.
- As a Member, I want to customize task statuses per List so each List reflects its own workflow.
- As a Member, I want to view tasks in List view or Board view depending on how I prefer to work.
- As a Member with Full Access, I want to duplicate a List as a starting point for a similar project.
- As an Admin, I want to archive a List when a project is completed so it stays accessible but out of the way.
- As a Member, I want to filter and sort tasks inside a List to focus on what matters right now.

---

## Features

### 1. Create List

- **Who can create:** Members with **Full Access** on the Space, Admin, Owner
- Required fields:
  - List Name (required)
  - Color (optional — pick from palette)
- Optional fields:
  - Description (short text about what this List is for)
  - Parent Space (auto-set to current Space)
- On creation:
  - Default statuses are automatically added (see [Default Statuses](#default-statuses))
  - User lands inside the new List, ready to add tasks

> **Special case — Space creation:** When a new Space is created, a default List named **"List"** is auto-created so the user can start adding tasks immediately. The user can rename it anytime.

---

### 2. Edit List

- **Who can edit:** Members with **Full Access** on the Space, Admin, Owner
- Editable fields:
  - Name
  - Color
  - Description
- Changes reflect immediately for all members

---

### 3. Archive List

- **Who can archive:** Members with **Full Access** on the Space, Admin, Owner
- Archived Lists are hidden from the active sidebar
- All Tasks inside are preserved and searchable
- No new Tasks can be created in an archived List
- Can be unarchived at any time
- Useful for completed sprints or finished projects

---

### 4. Delete List

- **Who can delete:** Admin, Owner only
- Permanently deletes the List and all Tasks, Subtasks, Comments, and Attachments inside
- Requires confirmation (type List name to confirm)
- Cannot be undone
- Recommended to Archive instead of Delete in most cases

---

### 5. Duplicate List

- **Who can duplicate:** Members with **Full Access** on the Space, Admin, Owner
- Creates a copy of the List with:
  - Name suffixed `(Copy)` by default (e.g. `Sprint 12 (Copy)`) — not prefixed "Copy of"
  - Same statuses and their configuration
  - Same color and description
  - Everything (tasks, descriptions, subtasks, checklists, dependencies, tags, assignees, priorities, due dates, archived tasks, completed tasks) is copied **by default** — the user can opt individual fields *out* via toggles, rather than opting tasks *in*. Attachments and comments/activity are never copied, regardless of toggles.
- Duplicated List is placed in the same Space as the original
- Useful for repeating project structures (e.g. monthly sprint template)

---

### 6. Custom Task Statuses

Each List has its own set of task statuses. This allows different Lists to reflect different workflows.

**Default Statuses (applied to every new List):**

| Status | Type | Color |
|--------|------|-------|
| Todo | open | Grey |
| In Progress | active | Blue |
| Review | active | Purple |
| Done | closed | Green |

**Status customization (Full Access / Admin+):**
- Add a new status (name + color)
- Rename an existing status
- Change status color
- Reorder statuses (drag-and-drop within group, or "Move up / Move down" from context menu)
- Delete a status
  - If tasks exist with that status, user must reassign them to another status before deletion

**Manage Statuses panel UI:**

The status settings panel (`components/list/manage-statuses-dialog.tsx`) is a Dialog that presents statuses in three labeled groups: **Not started** (OPEN), **Active** (ACTIVE), and **Closed** (CLOSED).

Each group has:
- A colored group header label (grey / blue / green) with a `+` button to add a status directly into that group
- Status rows: drag handle (DotsSixVertical) + color dot + name + context menu (`···`)
- An "Add status" dashed-border button at the bottom of the group

Context menu per status row (DotsThree popover):
- **Edit** — expands inline edit row with name input, color dot picker, and a type dropdown (to reassign to a different group)
- **Move up** / **Move down** — reorders within the full list
- **Delete** — guarded against statuses with assigned tasks and the last CLOSED status

"Add status" inline row (per group):
- Color dot picker (Popover with 10 swatches, defaults to group's default color)
- Name input (autoFocus, Enter to save, Escape to cancel)
- No type dropdown — the group determines the type

**Entry points for Manage Statuses:**
1. List header `···` menu → **Manage Statuses** (Full Access / Admin+)
2. Sidebar list `···` menu → **Manage Statuses** (Full Access / Admin+) — fetches statuses on demand via `getListStatuses` server action
3. Create Task modal → status popover → **Manage statuses** gear button at the bottom (only shown when `onManageStatuses` prop is provided)

**Status types:**
| Type | Meaning |
|------|---------|
| `open` | Task has not been started |
| `active` | Task is being worked on |
| `closed` | Task is complete or cancelled |

> Status type drives progress calculations and sprint burndown — closed = done.

---

### 7. List Views

Users can switch how tasks are displayed inside a List.

| View | Description |
|------|-------------|
| **List View** | Default — tasks displayed as rows, all fields visible inline |
| **Board View** | Kanban — tasks grouped into columns by status, drag-and-drop between columns |
| **Calendar View** | Tasks placed on a calendar by due date |

- View preference is **per user per List** — switching your view does not affect other members
- All views show the same tasks and respect the same filters

---

### 8. Filters & Sort

**Filters (applied per List, per user):**
- Status
- Priority
- Assignee
- Due Date (overdue, due today, due this week, custom range)
- Tags
- Created by

**Sort:**
- Due Date (ascending / descending)
- Priority
- Status
- Assignee
- Created Date
- Last Updated

- Sort is controlled from the **clickable column headers** (asc/desc caret on the
  active column); the toolbar Sort dropdown mirrors the same state and is the
  mobile entry point. See `docs/views.md` § List View → Sorting.
- Filter and sort state is **per user** — does not affect other members
- Users can save a filter combination as a named **Saved Filter** for quick access

---

## Default Statuses

Applied automatically when a new List is created:

```
Todo  →  In Progress  →  Review  →  Done
```

These can be customized after creation. They are not shared across Lists — each List manages its own statuses independently.

---

## Data Model

```
List
├── id                  (uuid, primary key)
├── space_id            (foreign key → Space)
├── folder_id           (foreign key → Folder, nullable — post-MVP; null in MVP)
├── name                (string, required)
├── description         (text, nullable)
├── color               (string — hex color code, nullable)
├── order_index         (integer — for sidebar ordering within Folder or Space)
├── is_archived         (boolean, default: false)
├── archived_at         (timestamp, nullable)
├── created_by          (user_id, foreign key)
├── created_at          (timestamp)
└── updated_at          (timestamp)

ListStatus
├── id                  (uuid, primary key)
├── list_id             (foreign key → List)
├── name                (string, required)
├── color               (string — hex color code)
├── type                (enum: open | active | closed)
├── order_index         (integer — display order)
└── created_at          (timestamp)
```

---

## Server Actions

There is no `/api/lists` REST surface — `app/api/lists/` only contains a pinned-tasks reorder route (see `docs/pinned-tasks.md`). List CRUD and status management are all Server Actions in `app/actions/list.ts`.

| Action | Description | Access |
|--------|-------------|--------|
| `createList(workspaceId, spaceId, data)` | Create a List (with default statuses, in one transaction) | Full Access / Admin+ |
| `getWorkspaceLists(...)` | Get all Lists in a Space | Space member |
| `updateList(...)` | Update List (name, color, description) | Full Access / Admin+ |
| `deleteList(...)` | Delete List permanently | Admin / Owner only |
| `archiveList(...)` / `unarchiveList(...)` | Archive / unarchive List | Full Access / Admin+ |
| `duplicateList(workspaceId, spaceId, listId, options?)` | Duplicate List with granular copy toggles (see Feature #5) | Full Access / Admin+ |
| `getListTaskCounts(...)` | Task counts for a List (for sidebar badges etc.) | Space member |
| `getListStatuses(...)` | Get all statuses for a List | Space member |
| `createListStatus(...)` | Add a new status | Full Access / Admin+ |
| `updateListStatus(...)` | Update status (name, color, type) | Full Access / Admin+ |
| `deleteListStatus(...)` | Delete a status (transaction-guarded, see Implementation Notes) | Full Access / Admin+ |
| `reorderListStatuses(workspaceId, spaceId, listId, orderedIds)` | Reorder statuses | Full Access / Admin+ |

There is no dedicated action for reordering Lists themselves in the sidebar — drag-and-drop sidebar list reordering isn't implemented (no `DndContext`/`useSortable` wiring found for the sidebar list group), so Business Rule #9 below describes intended, not current, behavior.

---

## UI Screens

| Screen | Description | Access |
|--------|-------------|--------|
| Sidebar — List items | Lists shown directly under Space in left sidebar | All Space members |
| List View | Tasks displayed as rows inside the List | All Space members |
| Board View | Tasks as Kanban cards grouped by status | All Space members |
| Calendar View | Tasks on calendar by due date | All Space members |
| Create List modal | Triggered from sidebar `+` next to Space | Full Access / Admin+ |
| Edit List modal | Accessible from List header `...` menu | Full Access / Admin+ |
| Status settings panel | Manage statuses for a List — grouped by type (Not started / Active / Closed). Entry points: List header `···` menu, sidebar list `···` menu, Create Task modal status popover | Full Access / Admin+ |
| Archive / Delete confirmation | Confirmation dialog before destructive actions | Full Access / Admin+ |

---

## Data Lifecycle

### Archive
- Archived Lists are hidden from the sidebar for all Space members.
- All Tasks and Subtasks inside are preserved — fully searchable.
- No new Tasks can be created in an archived List.
- Can be unarchived at any time — **no time limit**.
- Archiving a List does **not** archive its Tasks individually — Tasks remain in their current state inside the archived List.
- When unarchived, the List and all its Tasks become immediately accessible again with their existing statuses.
- If the parent Space is archived or deleted, the List follows the same fate.

### Soft Delete
- List deletion is a **hard delete** — no soft delete or recovery period.
- Archive is the strongly recommended alternative for any List with valuable task history.

### Recovery Period
- **Archived List:** Recoverable at any time — no expiry.
- **Deleted List:** No recovery. All data is permanently gone immediately.

### Permanent Deletion Rules
- Only **Admin and Owner** can permanently delete a List.
- Requires confirmation (type List name).
- On deletion, the List row itself is deleted, and the DB's FK cascade removes everything scoped to its Tasks (Subtasks, Checklists/ChecklistItems, TaskAttachment rows, Comments including tombstones, ActivityLog entries, ListStatus records, etc.) — no tombstone.
- **Storage cleanup is not yet wired up:** `deleteList()` (`app/actions/list.ts`) collects the task attachments' storage keys before the cascade delete, but the actual `storage.delete(...)` calls are commented out pending `lib/storage.ts` integration into this path — so today, deleting a List orphans its tasks' attachment files in storage rather than removing them. Treat this as a known gap, not documented behavior to rely on.

---

## Business Rules

1. Every Task must belong to exactly one List.
2. A List belongs to exactly one Space. Folder grouping is a post-MVP feature.
3. Each List manages its own statuses independently — status changes in one List do not affect other Lists.
4. Every List must have at least one status of type `closed` — required for task completion tracking.
5. A status with assigned tasks cannot be deleted until all its tasks are moved to another status.
6. Archiving a List locks it — no new tasks can be created but existing data remains intact.
7. Deleting a List is permanent and removes all tasks inside it — archive is preferred.
8. Duplicating a List offers granular per-field copy toggles (tasks, descriptions, subtasks, checklists, dependencies, tags, assignees, priorities, due dates, archived tasks, and whether to keep completed tasks) rather than a single "structure only vs. include tasks" choice — see `DuplicateListOptions` in `app/actions/list.ts`. Attachments and comments/activity are never copied, by design.
9. List order in the sidebar is global (`order_index`, set at creation time via a gap strategy — see Implementation Notes) — but there's currently no UI to manually reorder Lists after creation.
10. Filter and sort preferences are per user — they do not affect what others see.
11. The auto-created default List (named "List") on Space creation follows all the same rules and can be renamed or deleted like any other List.

---

## Implementation Notes

### Required Drizzle Indexes

These indexes are already defined in `db/schema/list.ts`:

```ts
index("list_space_id_idx").on(t.spaceId)             // list table
index("list_status_list_id_idx").on(t.listId)        // listStatus table
```

(An earlier draft of this doc also claimed a composite `list_space_archived_idx` on `(spaceId, isArchived)` — that one was never added; only `list_space_id_idx` exists.)

### `order_index` -- append-only, no rebalancing

There's no midpoint-insert-and-rebalance strategy in this codebase — it's simpler than that, because there's no manual List-reordering UI at all:

- **List creation:** `getNextListOrderIndex(spaceId)` (a private helper in `app/actions/list.ts`) returns `max(order_index) + 1000` for that Space — new Lists always go at the end.
- **Status creation:** the sibling `getNextStatusOrderIndex(listId)` does the same, `+1000` from the current max.
- **Status reordering** (`reorderListStatuses`): given a full ordered array of status IDs, it just rewrites every status's `orderIndex` to `(i + 1) * 1000` in one transaction — a full rewrite on every reorder, not an incremental midpoint insert.

### `createList` -- transaction with default statuses

`createList(workspaceId, spaceId, data)` (`app/actions/list.ts`) inserts the List and its `DEFAULT_STATUSES` (Todo/In Progress/Review/Done) inside one `db.transaction(...)` — matches the doc's original intent (atomic, list-without-statuses can't happen), just with real Drizzle code and IDs from `createId()` (cuid2), not `crypto.randomUUID()`.

### `deleteList` -- storage cleanup not yet wired (see Permanent Deletion Rules above)

`deleteList` collects attachment storage keys for the List's tasks before the cascade delete, but the actual `storage.delete(...)` calls are commented out with a `TODO: delete from R2 in batches when lib/storage.ts is configured` — so today it does **not** delete storage files, unlike the CLAUDE.md rule ("always delete the storage file before deleting the DB record") that this was clearly meant to follow. Only Admin/Owner can call it (not "Full Access", despite the Business Rules table above).

### `duplicateList` -- granular copy options, not a single toggle

See Feature #5 above and Business Rule #8 — `DuplicateListOptions` has a dozen independent copy toggles (defaulting to "copy everything"), not a binary "structure only vs. include tasks" choice. The new List's default name is `"${source.name} (Copy)"` (suffixed), and duplicated tasks get fresh IDs from `createId()` — attachments and comments/activity are never copied regardless of the toggles.

### Status deletion guard -- inside a transaction

`deleteListStatus` (`app/actions/list.ts`) does exactly what this doc originally specified: inside one `db.transaction(...)`, it re-checks (to avoid a TOCTOU race) that no non-archived task still uses the status, then — if the status is `CLOSED` — that at least one other `CLOSED` status remains, throwing `TASKS_EXIST:<n>` or `LAST_CLOSED_STATUS` accordingly and mapping those to a server-action `{ error: string }` result (there's no HTTP status code involved — this is a server action, not a route handler).

### Board View column order

Board View columns are the List's statuses in `ListStatus.orderIndex` order — no separate board column order. Reordering statuses via `reorderListStatuses` also reorders Board columns.

### Folder Mapping

```
app/actions/list.ts         <- createList, updateList, archiveList, unarchiveList, deleteList,
                                duplicateList, getListTaskCounts, createListStatus, updateListStatus,
                                deleteListStatus, reorderListStatuses, getWorkspaceLists, getListStatuses
app/api/lists/[listId]/pinned-tasks/reorder/route.ts  <- the only real /api/lists route (see docs/pinned-tasks.md)
components/list/manage-statuses-dialog.tsx            <- Manage Statuses panel
```

---

## Out of Scope (MVP)

- List templates (pre-built Lists with predefined statuses and tasks)
- List-level permission override (separate from Space permission)
- Table / Spreadsheet view
- Gantt / Timeline view
- List-level analytics and reporting
- Public List sharing (external link to a List without login)
- Importing tasks from CSV or external tools
