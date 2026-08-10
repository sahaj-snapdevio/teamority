// Shared filter vocabulary — the single source of truth for filter option lists,
// filter-state types, and small helpers used by BOTH the list/board filters and
// the global-search omnibox. Client-safe (no DB imports).

export type StatusType = "OPEN" | "ACTIVE" | "CLOSED";

export type DueValue = "" | "overdue" | "today" | "this_week" | "no_due_date";

export type SearchEntityType = "all" | "tasks" | "lists" | "spaces" | "members";

// Filters that constrain the task table. `status` = concrete status IDs (list
// view, scoped to one list); `statusType` = global buckets (omnibox, across
// lists). A value carrying both is valid — callers pass whichever they use.
export type TaskFilters = {
  status?: string[];
  statusType?: StatusType[];
  priority?: string[];
  assignee?: string[]; // userIds; supports the "unassigned" sentinel
  tags?: string[];
  sprint?: string[];
  due?: DueValue;
};

// Everything the omnibox can filter on (superset of TaskFilters).
export type GlobalSearchFilters = TaskFilters & {
  type?: SearchEntityType;
  space?: string[];
};

// Priority order matches the list/board views (URGENT first) so swapping them to
// the shared component keeps the exact same on-screen order.
export const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
  { value: "NONE", label: "No Priority" },
];

export const DUE_OPTIONS: { value: Exclude<DueValue, "">; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "no_due_date", label: "No Due Date" },
];

// Global status buckets (statuses are per-list, so the omnibox filters by type).
export const STATUS_TYPE_OPTIONS: { value: StatusType; label: string }[] = [
  { value: "OPEN", label: "To Do" },
  { value: "ACTIVE", label: "In Progress" },
  { value: "CLOSED", label: "Done" },
];

// Entity-type filter for the omnibox. "Projects" is the user-facing name for the
// Space entity (per project convention).
export const TYPE_OPTIONS: { value: SearchEntityType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "tasks", label: "Tasks" },
  { value: "lists", label: "Lists" },
  { value: "spaces", label: "Projects" },
  { value: "members", label: "Members" },
];

/** Immutable toggle of a value in a string array (add if absent, remove if present). */
export function toggle<T>(arr: T[] | undefined, val: T): T[] {
  const list = arr ?? [];
  return list.includes(val) ? list.filter((v) => v !== val) : [...list, val];
}

/** True when any omnibox filter is active (drives filter-only searches). */
export function hasActiveFilters(f: GlobalSearchFilters | undefined): boolean {
  if (!f) {
    return false;
  }
  return Boolean(
    (f.type && f.type !== "all") ||
      f.statusType?.length ||
      f.status?.length ||
      f.priority?.length ||
      f.assignee?.length ||
      f.space?.length ||
      f.sprint?.length ||
      f.tags?.length ||
      f.due
  );
}
