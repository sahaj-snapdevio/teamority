// Shared task-filter predicate used by the List, Board, and Calendar views so
// the four common filters (search / status / priority / assignee) behave
// identically everywhere instead of being re-implemented per view.
//
// Custom field filters/search extend this same predicate rather than adding a
// second filtering system — see lib/custom-fields/filters.ts for the per-type
// operator semantics this delegates to.

import type { CustomFieldRow } from "@/app/actions/custom-field";
import { describeCustomFieldValue } from "@/lib/custom-fields/column-display";
import {
  type CustomFieldFilters,
  matchesCustomFieldFilters,
} from "@/lib/custom-fields/filters";

export interface TaskFilterState {
  assigneeFilter: string[]; // user IDs, plus the literal "unassigned"
  customFieldFilters?: CustomFieldFilters; // keyed by custom field id
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
  customFieldValues?: Record<string, unknown>;
};

type SearchMember = {
  userId: string;
  name: string | null;
  email: string | null;
};

export function matchesTaskFilters(
  t: FilterableTask,
  f: TaskFilterState,
  customFields: CustomFieldRow[] = [],
  members: SearchMember[] = []
): boolean {
  const query = f.searchQuery.trim().toLowerCase();
  if (query) {
    const titleMatch = t.title.toLowerCase().includes(query);
    const customFieldMatch = customFields.some((field) => {
      const text = describeCustomFieldValue(
        field,
        t.customFieldValues?.[field.id],
        members
      );
      return text?.toLowerCase().includes(query);
    });
    if (!titleMatch && !customFieldMatch) {
      return false;
    }
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
  if (!matchesCustomFieldFilters(t.customFieldValues, f.customFieldFilters)) {
    return false;
  }
  return true;
}

export function filterTasks<T extends FilterableTask>(
  tasks: T[],
  f: TaskFilterState,
  customFields: CustomFieldRow[] = [],
  members: SearchMember[] = []
): T[] {
  return tasks.filter((t) => matchesTaskFilters(t, f, customFields, members));
}
