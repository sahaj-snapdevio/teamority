import type {
  CustomFieldRow,
  CustomFieldType,
} from "@/app/actions/custom-field";

// Shared between the List View header (list-view.tsx) and row cells
// (task-list-row.tsx) so a column's header and its cells always agree on
// width. Every type is a fixed width sized to its typical content — TEXT used
// to be `flex-1`, but that made it compete with the Name column's own
// `flex-1` for whatever space was left, ballooning to fill the row on lists
// with few other visible columns (values still truncate + carry a `title`
// tooltip, so a fixed width doesn't lose anything).
export const CUSTOM_FIELD_COLUMN_WIDTH_CLASS: Record<CustomFieldType, string> =
  {
    TEXT: "w-[160px] shrink-0",
    NUMBER: "w-[90px] shrink-0",
    CHECKBOX: "w-[60px] shrink-0",
    SINGLE_SELECT: "w-[140px] shrink-0",
    MULTI_SELECT: "w-[180px] shrink-0",
    DATE: "w-[140px] shrink-0",
    PERSON: "w-[180px] shrink-0",
  };

// Presentation only — normalizes a stored field name for header display
// without mutating the underlying data (an admin's saved field name might
// be lowercase, ALL CAPS, etc.).
export function toTitleCase(value: string): string {
  return value.replace(
    /\w\S*/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );
}

// Full, human-readable value for a `title` attribute (hover tooltip) — a
// column cell can be visually truncated, but the title always carries the
// complete value. Presentation-only; doesn't affect what's stored/edited.
export function describeCustomFieldValue(
  field: CustomFieldRow,
  value: unknown,
  members: { name: string | null; email: string | null; userId: string }[]
): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  switch (field.type) {
    case "SINGLE_SELECT": {
      const option = field.config.options?.find((o) => o.id === value);
      return option?.label ?? "";
    }
    case "MULTI_SELECT": {
      const ids = Array.isArray(value) ? (value as string[]) : [];
      const options = field.config.options ?? [];
      return ids
        .map((id) => options.find((o) => o.id === id)?.label)
        .filter(Boolean)
        .join(", ");
    }
    case "PERSON": {
      const member = members.find((m) => m.userId === value);
      return member?.name ?? member?.email ?? "";
    }
    case "DATE": {
      const date = new Date(value as string);
      return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
    }
    case "CHECKBOX":
      return value ? "Yes" : "No";
    default:
      return String(value);
  }
}
