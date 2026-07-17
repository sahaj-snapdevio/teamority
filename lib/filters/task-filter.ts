// Shared task-filter predicate used by the List, Board, and Calendar views so
// the four common filters (search / status / priority / assignee) behave
// identically everywhere instead of being re-implemented per view.

export interface TaskFilterState {
  assigneeFilter: string[]; // user IDs, plus the literal "unassigned"
  priorityFilter: string[]; // "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  searchQuery: string;
  statusFilter: string[]; // status IDs
}

// The minimal task shape the filters read.
export type FilterableTask = {
  title: string;
  statusId: string | null;
  priority: string;
  assignees: { userId: string }[];
};

export function matchesTaskFilters(
  t: FilterableTask,
  f: TaskFilterState
): boolean {
  if (
    f.searchQuery.trim() &&
    !t.title.toLowerCase().includes(f.searchQuery.toLowerCase())
  ) {
    return false;
  }
  if (f.statusFilter.length > 0 && !f.statusFilter.includes(t.statusId ?? "")) {
    return false;
  }
  if (f.priorityFilter.length > 0 && !f.priorityFilter.includes(t.priority)) {
    return false;
  }
  if (f.assigneeFilter.length > 0) {
    const hasUnassigned = f.assigneeFilter.includes("unassigned");
    const userIds = f.assigneeFilter.filter((a) => a !== "unassigned");
    const assigneeIds = t.assignees.map((a) => a.userId);
    const matchUnassigned = hasUnassigned && assigneeIds.length === 0;
    const matchUser =
      userIds.length > 0 && assigneeIds.some((id) => userIds.includes(id));
    if (!matchUnassigned && !matchUser) {
      return false;
    }
  }
  return true;
}

export function filterTasks<T extends FilterableTask>(
  tasks: T[],
  f: TaskFilterState
): T[] {
  return tasks.filter((t) => matchesTaskFilters(t, f));
}
