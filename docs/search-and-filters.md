# Search & Filters

## Overview

Search and Filters help users find and focus on the right tasks quickly. There are two distinct systems:

- **Global Search** — find anything across the entire workspace instantly (tasks, lists, spaces, members)
- **List Filters & Sort** — narrow down and organize tasks within a specific List or View

Both are independent but complementary. Global Search is for discovery; Filters are for focused work.

---

## 1. Global Search

A fast, workspace-wide search accessible from anywhere in the app.

### Access

- Keyboard shortcut: `Ctrl + K` (Windows) / `Cmd + K` (Mac) — opens the search command palette
- Click the search icon in the top navigation bar
- Available on every page in the app
- For the full list of keyboard shortcuts across the app, see [keyboard-shortcuts.md](./keyboard-shortcuts.md)

### What can be searched

| Type | Searchable fields |
|------|------------------|
| Tasks | Title |
| Subtasks | Title |
| Lists | Name |
| Spaces | Name |
| Members | Name, email |
| Tags | Name |

### Search behavior

- Search begins after typing **2 or more characters**
- Results appear instantly as the user types (debounced — 300ms delay to avoid excess requests)
- Results are grouped by type: Tasks, Lists, Spaces, Members
- Maximum **10 results per group** shown in the dropdown — pressing Enter or clicking "View all results" opens the full results page
- Search respects permissions — only shows results from Spaces the user has access to
- Private Spaces the user is not a member of are completely excluded from results

### Search result item (Task)

Each task result shows:
- Task title (with matching term highlighted)
- Space name → List name (breadcrumb context)
- Status pill
- Assignee avatar(s)
- Due date (red if overdue)

Clicking a result opens the Task detail panel directly.

### Search result item (List / Space / Member)

- **List:** Name + Space it belongs to → click to navigate to that List
- **Space:** Name + member count → click to navigate to that Space
- **Member:** Avatar + name + email → click to open their profile

### Full results page (not implemented)

There is no dedicated `/search` results page — `globalSearch()` results render directly inside the `Ctrl+K`/`Cmd+K` palette (`components/search/search-palette.tsx`), and selecting a result navigates straight to it. The filter-sidebar / sort-by-Relevance design below was never built as a separate page; kept here as design-intent reference only.

- Filter by type (Tasks / Lists / Spaces / Members)
- Filter by Space
- Filter by Assignee
- Filter by Status
- Filter by Date range (created or updated)
- Results sortable by: Relevance (default) / Created Date / Last Updated

### Recent

When the search palette opens with no input, it shows the **last 5 items** the user visited in this workspace (tasks, lists, spaces — `getRecentSearches()`, ordered by `visitedAt`). There is no separate "frequently visited" suggestion feature — only recency-based history.

---

## 2. List Filters

Filters narrow down which tasks are visible within a List or View. They are applied per user and do not affect what others see.

### Access

- **Status**, **Priority**, and **Assignee** each have their own dedicated toolbar button (List View and Board View) — a `FacetFilter` chip that opens a checkbox popover directly, not tucked inside a `Filters` menu.
- A separate `Filters` button (icon: funnel) covers **Custom Fields only** — it exists so custom fields don't need their own always-visible toolbar button apiece. It is **hidden entirely when the project has zero active custom fields** (there'd be nothing to filter). See `docs/custom-fields.md` § List / Board Toolbar Integration.
- Multiple filters can be active at the same time (AND logic — all conditions must match).

### Available Filters

| Filter | Options | Where |
|--------|---------|-------|
| **Status** | Select one or more statuses from the List's status set | Dedicated toolbar button |
| **Priority** | None / Low / Medium / High / Urgent (multi-select) | Dedicated toolbar button |
| **Assignee** | Select one or more workspace members; option: `Unassigned` | Dedicated toolbar button |
| **Custom Fields** | Per-field operator + value (Text/Number/Date/Checkbox/Select/Person) | `Filters` button, one entry per field |

> Due Date / Tags / Created By / Created Date / Last Updated filters described below are aspirational — not present in the current List/Board toolbar implementation. Treat this table as the source of truth for what's actually built; update it alongside any future work that adds them.

### Filter logic

- Multiple values within the same filter = **OR** (e.g. Priority: High OR Urgent)
- Multiple different filters active = **AND** (e.g. Assignee: Jane AND Priority: High)
- Example: `Assignee: Jane OR John` AND `Priority: Urgent OR High` AND `Due Date: This Week`

### Filter chips (not in the current List/Board toolbar)

> `components/list/list-filter-toolbar.tsx` implements chips + Saved Filters as described below, but it isn't mounted anywhere in `app/` — the live List/Board toolbars use the dedicated Status/Priority/Assignee buttons + `Filters` (custom fields) described above instead. Treat this subsection as a design reference, not current behavior, until/unless that component is wired in.

Active filters show as chips in the toolbar:
```
[Assignee: Jane ×]  [Priority: High, Urgent ×]  [Due Date: This Week ×]  [Clear All]
```
- Click `×` on a chip to remove that filter
- Click `Clear All` to remove all active filters

### Saved Filters (not in the current List/Board toolbar — see note above)

- Users can save a combination of active filters as a named Saved Filter
- Save button appears in the filter panel when at least one filter is active
- Saved Filters are **per user per List** — not shared with other members
- Saved Filters appear as a dropdown in the filter toolbar for quick reapplication
- Maximum **10 saved filters per List per user**
- Saved Filters can be renamed or deleted

---

## 3. Sort

Sorting controls the order tasks appear within a List View or within columns in Board View.

### Sort options

| Sort by | Direction |
|---------|-----------|
| Manual (default) | Drag-and-drop order — user-defined |
| Due Date | Ascending (earliest first) / Descending |
| Priority | Highest first / Lowest first |
| Status | By status order defined in List settings |
| Assignee | Alphabetical A–Z / Z–A |
| Created Date | Newest first / Oldest first |
| Last Updated | Most recently updated first / Oldest |

### Sort behavior

- Only one sort can be active at a time
- Sort is **per user** — does not affect other members
- When a sort is active, manual drag-and-drop reordering is disabled (sort order takes precedence)
- Sort preference is saved per user per List and persists across sessions

---

## 4. Filters + Sort in My Tasks View

My Tasks has its own filter and sort options since it is workspace-wide (not List-specific).

### My Tasks Filters

| Filter | Options |
|--------|---------|
| **Space** | Select one or more Spaces |
| **List** | Select one or more Lists |
| **Priority** | None / Low / Medium / High / Urgent |
| **Status** | Select statuses across all Lists |
| **Due Date** | Overdue / Today / This Week / Custom Range |
| **Show Completed** | Toggle — hide or show closed tasks (default: hidden) |

### My Tasks Sort

| Sort by | Direction |
|---------|-----------|
| Due Date (default) | Soonest first |
| Priority | Highest first |
| Status | By type (open → active → closed) |
| List | Alphabetical |
| Space | Alphabetical |
| Created Date | Newest first |

---

## Data Model

```
SavedFilter
├── id                  (uuid, primary key)
├── user_id             (foreign key → User)
├── list_id             (foreign key → List)
├── name                (string, required)
├── filters             (json — serialized filter state)
│                         e.g. { assignees: [...], priorities: [...], due_date: "this_week" }
├── created_at          (timestamp)
└── updated_at          (timestamp)

UserSearchHistory
├── id                  (uuid, primary key)
├── user_id             (foreign key → User)
├── workspace_id        (foreign key → Workspace)
├── entity_type         (enum: task | list | space | member)
├── entity_id           (uuid — id of the visited item)
└── visited_at          (timestamp)
```

---

## Server Actions

Search and filtering are implemented entirely as server actions (`app/actions/search.ts`) — there are no dedicated `/api/` REST routes for this feature.

### Global Search

| Action | Description | Access |
|--------|-------------|--------|
| `globalSearch(workspaceId, query)` | Global search across the workspace | Workspace member |
| `getRecentSearches(workspaceId)` | Recent + suggested items for the user | Workspace member |
| `recordSearchVisit(...)` | Records an item visit for search history | Workspace member |

### List Filters & Sort

| Action | Description | Access |
|--------|-------------|--------|
| `getFilteredTasks(listId, filters, sort)` | Get tasks with filters and sort applied | Space member |
| `getSearchFilterOptions(...)` | Available filter facets (assignees, tags, etc.) for the current List | Space member |
| `getSavedFilters(listId)` | Get saved filters for a List | Space member |
| `createSavedFilter(...)` | Save a new filter | Space member |
| `renameSavedFilter(id, name)` | Rename a saved filter | Filter owner |
| `deleteSavedFilter(id)` | Delete a saved filter | Filter owner |

### My Tasks

| Action | Description | Access |
|--------|-------------|--------|
| `getMyTasks(...)` (`app/actions/my-tasks.ts`) | Get My Tasks with filters and sort, cross-workspace — see CLAUDE.md's "My Tasks (global)" section | Authenticated user |

---

## UI Screens

| Screen | Description | Access |
|--------|-------------|--------|
| Global Search palette | `Ctrl+K` / `Cmd+K` overlay (`components/search/search-palette.tsx`) — instant results as you type, selecting a result navigates straight to it (task, list, or space) | All workspace members |
| List filter toolbar | Filter chips + filter panel in List / Board / Calendar views | All Space members |
| Saved filters dropdown | Quick-apply saved filter combinations in List toolbar | All Space members |
| My Tasks filter panel | Filter sidebar in My Tasks view | All workspace members |

---

## Business Rules

1. Global Search only returns results from Spaces the user has access to — private Spaces the user is not a member of are fully excluded.
2. Search results for tasks inside archived Lists or Spaces are excluded by default — can be included via a toggle `Include Archived`.
3. Filters are per user — applying or clearing a filter does not affect what other members see.
4. Multiple values within the same filter use OR logic; multiple different filters use AND logic.
5. When a sort other than Manual is active, drag-and-drop task reordering is disabled for that user.
6. Saved Filters are per user per List — they are not shared or visible to other team members.
7. Saved Filter limit is 10 per user per List to prevent clutter.
8. Global Search respects the same permission model as the rest of the app — no information is exposed through search that the user would not otherwise have access to.
9. Search history (recent items) is per user and per workspace — switching workspace shows that workspace's recent history.
10. Filters and sort preferences persist across sessions — they are restored when the user returns to the same List.

---

## Implementation Notes

### FTS Scope -- Title Only at MVP (Critical)

Task `description` is stored as `jsonb` (Tiptap JSON). PostgreSQL `@@to_tsquery` and `tsvector` do not work on `jsonb` columns without a generated column extracting the text first. **Do NOT attempt to search description at MVP** -- it will either error or silently return no matches.

Global search queries **`title` and `name` fields only**. The Out of Scope section documents the post-MVP path (generated `tsvector` column + GIN index).

### Global Search Query

`globalSearch(workspaceId, query, filters?)` in `app/actions/search.ts` (Drizzle, not the ORM-agnostic pseudocode in earlier drafts of this doc):

- Requires either a text query of 2+ characters or at least one active structured filter (a filter-only search, e.g. "assigned to John" with no text, returns tasks only — lists/spaces/members have no structured filters and need text).
- Scopes every result type to `getAccessibleSpaceIds(userId, workspaceId)` first.
- Text matching uses `ILIKE '%query%'`-equivalent conditions (`matchesTaskTextSearch` and similar helpers) — sufficient for MVP; the Out of Scope section below covers the post-MVP `tsvector` + GIN index path.
- Runs the tasks/lists/spaces/members lookups as parallel queries, each capped and filtered to non-archived rows.

### Search History -- Deduplicate and Trim

`recordSearchVisit(workspaceId, entityType, entityId)` in `app/actions/search.ts` tracks recent visits in `userSearchHistory`. It's a delete-then-insert (not a DB-level `ON CONFLICT` upsert): delete any existing row for `(userId, workspaceId, entityType, entityId)`, insert a fresh row with the current `visitedAt`, then read back all of that user+workspace's history ordered by `visitedAt DESC` and delete anything past the 20 most recent.

`db/schema/search.ts` has one index on `userSearchHistory`: `index("user_search_history_idx").on(userId, workspaceId)` — there is no unique constraint on the full `(userId, workspaceId, entityType, entityId)` tuple; de-duplication is handled in application code via the delete-then-insert above, not the database.

### Filter-to-Drizzle Query Builder

`getFilteredTasks(workspaceId, spaceId, listId, filters)` (`app/actions/search.ts`) is the real server action — there's no `GET /api/lists/:listId/tasks` route. It builds its `where` conditions via a shared `buildTaskFilterConditions(filters)` helper (the same one the global-search omnibox uses) rather than the standalone `buildTaskFilters`/`buildTaskOrderBy` functions shown below — the illustrative approach below (incremental `and()` of Drizzle conditions per filter, `EXISTS` subqueries for assignee/tags, date-range buckets for `due`) is representative of the strategy used, not a byte-for-byte copy of the current code:

```typescript
// server/task-filters.ts
import { db } from '@/lib/db'
import { task, taskAssignee, taskTag, listStatus } from '@/db/schema'
import { and, eq, inArray, isNull, lt, gte, lte, ne, exists } from 'drizzle-orm'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

interface FilterParams {
  status?: string[]       // status IDs
  priority?: string[]     // 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'NONE'
  assignee?: string[]     // user IDs; 'unassigned' is a special sentinel
  due?: string            // 'overdue' | 'today' | 'this_week' | 'this_month' | 'no_due_date'
  dueDateFrom?: string    // ISO date string (custom range)
  dueDateTo?: string
  tags?: string[]         // tag IDs
  createdBy?: string[]
  createdFrom?: string
  createdTo?: string
  sort?: string
  dir?: 'asc' | 'desc'
}

export function buildTaskFilters(listId: string, params: FilterParams) {
  const conditions = [
    eq(task.listId, listId),
    eq(task.isArchived, false),
    isNull(task.parentTaskId),
  ]

  if (params.status?.length) {
    conditions.push(inArray(task.statusId, params.status))
  }

  if (params.priority?.length) {
    conditions.push(inArray(task.priority, params.priority as any[]))
  }

  // assignee filter uses EXISTS subquery
  if (params.assignee?.length) {
    const hasUnassigned = params.assignee.includes('unassigned')
    const userIds = params.assignee.filter(a => a !== 'unassigned')

    if (hasUnassigned && userIds.length > 0) {
      // tasks with no assignee OR assigned to one of the specified users
      // Use raw SQL for OR-of-subqueries pattern
      conditions.push(sql`(
        NOT EXISTS (SELECT 1 FROM task_assignee ta WHERE ta.task_id = ${task.id})
        OR EXISTS (SELECT 1 FROM task_assignee ta WHERE ta.task_id = ${task.id} AND ta.user_id = ANY(${userIds}::text[]))
      )`)
    } else if (hasUnassigned) {
      conditions.push(sql`NOT EXISTS (SELECT 1 FROM task_assignee ta WHERE ta.task_id = ${task.id})`)
    } else if (userIds.length) {
      conditions.push(sql`EXISTS (SELECT 1 FROM task_assignee ta WHERE ta.task_id = ${task.id} AND ta.user_id = ANY(${userIds}::text[]))`)
    }
  }

  if (params.due) {
    const now = new Date()
    switch (params.due) {
      case 'overdue':
        conditions.push(lt(task.dueDateEnd, now))
        conditions.push(sql`EXISTS (SELECT 1 FROM list_status ls WHERE ls.id = ${task.statusId} AND ls.type != 'CLOSED')`)
        break
      case 'today':
        conditions.push(gte(task.dueDateEnd, startOfDay(now)))
        conditions.push(lte(task.dueDateEnd, endOfDay(now)))
        break
      case 'this_week':
        conditions.push(gte(task.dueDateEnd, startOfWeek(now)))
        conditions.push(lte(task.dueDateEnd, endOfWeek(now)))
        break
      case 'this_month':
        conditions.push(gte(task.dueDateEnd, startOfMonth(now)))
        conditions.push(lte(task.dueDateEnd, endOfMonth(now)))
        break
      case 'no_due_date':
        conditions.push(isNull(task.dueDateEnd))
        break
    }
  }

  if (params.dueDateFrom) conditions.push(gte(task.dueDateEnd, new Date(params.dueDateFrom)))
  if (params.dueDateTo)   conditions.push(lte(task.dueDateEnd, new Date(params.dueDateTo)))

  if (params.tags?.length) {
    conditions.push(sql`EXISTS (SELECT 1 FROM task_tag tt WHERE tt.task_id = ${task.id} AND tt.tag_id = ANY(${params.tags}::text[]))`)
  }

  if (params.createdBy?.length) {
    conditions.push(inArray(task.reporterId, params.createdBy))
  }

  if (params.createdFrom) conditions.push(gte(task.createdAt, new Date(params.createdFrom)))
  if (params.createdTo)   conditions.push(lte(task.createdAt, new Date(params.createdTo)))

  return and(...conditions)
}

export function buildTaskOrderBy(sort?: string, dir: 'asc' | 'desc' = 'asc') {
  const d = dir === 'desc' ? desc : asc
  switch (sort) {
    case 'due_date':    return d(task.dueDateEnd)
    case 'priority':    return d(task.priority)
    case 'created_at':  return d(task.createdAt)
    case 'updated_at':  return d(task.updatedAt)
    default:            return asc(task.orderIndex)  // manual sort
  }
}
```

### Saved Filter Limit -- Server-Side Check

The 10-per-user-per-List limit is enforced server-side in `createSavedFilter(listId, name, filters)` (`app/actions/search.ts`), not just the frontend — it counts the user's existing rows for that List and returns `{ error: "Saved filter limit reached (10 per list). Delete one to save a new filter." }` (a server-action error result, not an HTTP status) once the count reaches 10, before inserting.

### Debounce -- Client Hook

```typescript
// hooks/use-debounced-search.ts

export function useDebouncedSearch(delay = 300) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    if (query.length < 2) { setDebouncedQuery(''); return }
    const timer = setTimeout(() => setDebouncedQuery(query), delay)
    return () => clearTimeout(timer)
  }, [query, delay])

  return { query, setQuery, debouncedQuery }
}
```

`search-palette.tsx` calls `globalSearch(workspaceId, debouncedQuery, filters)` directly (a server action call, not a `useSWR` fetch against a REST endpoint) inside a `useEffect` keyed on `[debouncedQuery, filters, workspaceId]` — so it re-runs only when the debounced query or filters change, same effect as an SWR key change would give.

### Folder Mapping

```
app/actions/search.ts                          <- globalSearch, getRecentSearches, recordSearchVisit,
                                                    getSavedFilters/createSavedFilter/renameSavedFilter/
                                                    deleteSavedFilter, getFilteredTasks, getSearchFilterOptions
app/actions/my-tasks.ts                         <- getMyTasks
hooks/use-debounced-search.ts                   <- useDebouncedSearch
components/search/search-palette.tsx            <- the Ctrl+K/Cmd+K palette UI
db/schema/search.ts                             <- userSearchHistory, savedFilter
```

There are no `/api/` routes for search, filters, or saved filters — everything above is a server action.

---

## Out of Scope (MVP)

- Search inside task descriptions (title-only in MVP; post-MVP will add description search with a "Search in descriptions" toggle — requires a generated `tsvector` column on the Task table)
- Full-text search inside file attachments (e.g. searching inside a PDF)
- Search inside comment bodies
- Shared/team-level saved filters (visible to all members of a Space)
- Advanced search operators (e.g. `assignee:jane due:this-week status:review`)
- Search across multiple workspaces simultaneously
- Boolean filter logic customization (switching AND/OR between filter groups)
