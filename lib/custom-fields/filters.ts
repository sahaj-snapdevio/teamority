// Per-type custom field filter semantics — the operator vocabulary and match
// logic for each of the 7 field types. Parallel to validation.ts (write-time
// checks) and column-display.ts (read-only formatting): this is the
// filter-time concern. Client-safe (no DB imports) so it can run against the
// already-loaded task list in List/Board View (lib/filters/task-filter.ts),
// which is the single place tasks are actually filtered — this module only
// supplies the per-field-type predicate, it isn't a second filtering system.

import {
  addDays,
  endOfMonth,
  endOfWeek,
  isSameDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type TextFilterOperator =
  | "contains"
  | "equals"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty";

export type NumberFilterOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "is_empty"
  | "is_not_empty";

export type DateFilterOperator =
  | "on"
  | "before"
  | "after"
  | "between"
  | "today"
  | "tomorrow"
  | "this_week"
  | "this_month"
  | "is_empty"
  | "is_not_empty";

export type CheckboxFilterOperator = "checked" | "unchecked";

export type SingleSelectFilterOperator =
  | "equals"
  | "not_equals"
  | "is_empty"
  | "is_not_empty";

export type MultiSelectFilterOperator =
  | "contains_any"
  | "contains_all"
  | "not_contains"
  | "is_empty"
  | "is_not_empty";

export type PersonFilterOperator =
  | "is"
  | "is_not"
  | "is_empty"
  | "is_not_empty";

export type CustomFieldFilterValue =
  | { type: "TEXT"; operator: TextFilterOperator; value?: string }
  | {
      type: "NUMBER";
      operator: NumberFilterOperator;
      value?: number;
      valueMax?: number;
    }
  | {
      type: "DATE";
      operator: DateFilterOperator;
      value?: string;
      valueMax?: string;
    }
  | { type: "CHECKBOX"; operator: CheckboxFilterOperator }
  | {
      type: "SINGLE_SELECT";
      operator: SingleSelectFilterOperator;
      value?: string;
    }
  | {
      type: "MULTI_SELECT";
      operator: MultiSelectFilterOperator;
      value?: string[];
    }
  | { type: "PERSON"; operator: PersonFilterOperator; value?: string };

export type CustomFieldFilters = Record<string, CustomFieldFilterValue>;

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

export function matchesCustomFieldFilter(
  value: unknown,
  filter: CustomFieldFilterValue
): boolean {
  switch (filter.type) {
    case "TEXT": {
      const str = isBlank(value) ? "" : String(value);
      switch (filter.operator) {
        case "is_empty":
          return str === "";
        case "is_not_empty":
          return str !== "";
        case "contains":
          return (
            !filter.value ||
            str.toLowerCase().includes(filter.value.toLowerCase())
          );
        case "equals":
          return str.toLowerCase() === (filter.value ?? "").toLowerCase();
        case "starts_with":
          return str
            .toLowerCase()
            .startsWith((filter.value ?? "").toLowerCase());
        case "ends_with":
          return str.toLowerCase().endsWith((filter.value ?? "").toLowerCase());
        default:
          return true;
      }
    }
    case "NUMBER": {
      const empty = isBlank(value);
      if (filter.operator === "is_empty") {
        return empty;
      }
      if (filter.operator === "is_not_empty") {
        return !empty;
      }
      if (empty) {
        return false;
      }
      const num = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(num)) {
        return false;
      }
      switch (filter.operator) {
        case "eq":
          return filter.value !== undefined && num === filter.value;
        case "ne":
          return filter.value !== undefined && num !== filter.value;
        case "gt":
          return filter.value !== undefined && num > filter.value;
        case "gte":
          return filter.value !== undefined && num >= filter.value;
        case "lt":
          return filter.value !== undefined && num < filter.value;
        case "lte":
          return filter.value !== undefined && num <= filter.value;
        case "between":
          return (
            filter.value !== undefined &&
            filter.valueMax !== undefined &&
            num >= filter.value &&
            num <= filter.valueMax
          );
        default:
          return true;
      }
    }
    case "DATE": {
      const empty = isBlank(value);
      if (filter.operator === "is_empty") {
        return empty;
      }
      if (filter.operator === "is_not_empty") {
        return !empty;
      }
      if (empty) {
        return false;
      }
      const date = new Date(value as string);
      if (Number.isNaN(date.getTime())) {
        return false;
      }
      const now = new Date();
      switch (filter.operator) {
        case "today":
          return isSameDay(date, now);
        case "tomorrow":
          return isSameDay(date, addDays(now, 1));
        case "this_week":
          return date >= startOfWeek(now) && date <= endOfWeek(now);
        case "this_month":
          return date >= startOfMonth(now) && date <= endOfMonth(now);
        case "on":
          return !!filter.value && isSameDay(date, new Date(filter.value));
        case "before":
          return (
            !!filter.value && date.getTime() < new Date(filter.value).getTime()
          );
        case "after":
          return (
            !!filter.value && date.getTime() > new Date(filter.value).getTime()
          );
        case "between":
          return (
            !!filter.value &&
            !!filter.valueMax &&
            date.getTime() >= new Date(filter.value).getTime() &&
            date.getTime() <= new Date(filter.valueMax).getTime()
          );
        default:
          return true;
      }
    }
    case "CHECKBOX":
      return filter.operator === "checked" ? !!value : !value;
    case "SINGLE_SELECT": {
      const empty = isBlank(value);
      switch (filter.operator) {
        case "is_empty":
          return empty;
        case "is_not_empty":
          return !empty;
        case "equals":
          return !empty && filter.value !== undefined && value === filter.value;
        case "not_equals":
          return empty || filter.value === undefined || value !== filter.value;
        default:
          return true;
      }
    }
    case "MULTI_SELECT": {
      const ids = Array.isArray(value) ? (value as string[]) : [];
      const empty = ids.length === 0;
      const selected = filter.value ?? [];
      switch (filter.operator) {
        case "is_empty":
          return empty;
        case "is_not_empty":
          return !empty;
        case "contains_any":
          return (
            selected.length === 0 || ids.some((id) => selected.includes(id))
          );
        case "contains_all":
          return selected.every((id) => ids.includes(id));
        case "not_contains":
          return (
            selected.length === 0 || !ids.some((id) => selected.includes(id))
          );
        default:
          return true;
      }
    }
    case "PERSON": {
      const empty = isBlank(value);
      switch (filter.operator) {
        case "is_empty":
          return empty;
        case "is_not_empty":
          return !empty;
        case "is":
          return !empty && filter.value !== undefined && value === filter.value;
        case "is_not":
          return empty || filter.value === undefined || value !== filter.value;
        default:
          return true;
      }
    }
    default:
      return true;
  }
}

// A task must satisfy every active per-field filter (AND across fields).
export function matchesCustomFieldFilters(
  values: Record<string, unknown> | undefined,
  filters: CustomFieldFilters | undefined
): boolean {
  if (!filters) {
    return true;
  }
  for (const fieldId of Object.keys(filters)) {
    if (!matchesCustomFieldFilter(values?.[fieldId], filters[fieldId])) {
      return false;
    }
  }
  return true;
}

// Whether a single field's filter currently constrains anything — drives the
// row's "does this need a value before it does anything" state. Operators
// that don't need a value (is_empty/is_not_empty, the DATE shortcuts, and
// CHECKBOX's checked/unchecked) are active the moment they're picked.
export function isCustomFieldFilterActive(
  filter: CustomFieldFilterValue | undefined
): boolean {
  if (!filter) {
    return false;
  }
  switch (filter.type) {
    case "TEXT":
      return (
        filter.operator === "is_empty" ||
        filter.operator === "is_not_empty" ||
        !!filter.value
      );
    case "NUMBER":
      return (
        filter.operator === "is_empty" ||
        filter.operator === "is_not_empty" ||
        filter.value !== undefined
      );
    case "DATE":
      return (
        filter.operator === "today" ||
        filter.operator === "tomorrow" ||
        filter.operator === "this_week" ||
        filter.operator === "this_month" ||
        filter.operator === "is_empty" ||
        filter.operator === "is_not_empty" ||
        !!filter.value
      );
    case "CHECKBOX":
      return true;
    case "SINGLE_SELECT":
    case "PERSON":
      return (
        filter.operator === "is_empty" ||
        filter.operator === "is_not_empty" ||
        !!filter.value
      );
    case "MULTI_SELECT":
      return (
        filter.operator === "is_empty" ||
        filter.operator === "is_not_empty" ||
        (filter.value?.length ?? 0) > 0
      );
    default:
      return false;
  }
}

// True when at least one field in the map is actually constraining results —
// lets a caller decide whether "custom field filters" as a whole are active
// without inspecting each entry itself.
export function hasActiveCustomFieldFilters(
  filters: CustomFieldFilters | undefined
): boolean {
  if (!filters) {
    return false;
  }
  return Object.values(filters).some((f) => isCustomFieldFilterActive(f));
}
