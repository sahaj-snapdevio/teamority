import type { CustomFieldConfig } from "@/db/schema";
import { getWorkspaceMembership } from "@/lib/permissions";

export interface CustomFieldLike {
  config: CustomFieldConfig;
  type:
    | "TEXT"
    | "NUMBER"
    | "CHECKBOX"
    | "SINGLE_SELECT"
    | "MULTI_SELECT"
    | "DATE"
    | "PERSON";
}

// Validates (and normalizes) a value against a field's type/config before it's
// persisted — used for both custom_field_value.value and
// custom_field_definition.defaultValue, so there's exactly one place that
// knows what a valid value looks like per type. Hand-rolled per-type checks,
// matching this codebase's dominant validation style (no z.discriminatedUnion
// precedent exists anywhere in the app).
export async function validateCustomFieldValue(
  field: CustomFieldLike,
  workspaceId: string,
  value: unknown
): Promise<{ value: unknown } | { error: string }> {
  if (value === null || value === undefined) {
    return { value: null };
  }

  switch (field.type) {
    case "TEXT": {
      if (typeof value !== "string") {
        return { error: "Value must be text" };
      }
      return { value };
    }

    case "NUMBER": {
      const num = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(num)) {
        return { error: "Value must be a number" };
      }
      const { min, max } = field.config;
      if (min !== undefined && num < min) {
        return { error: `Value must be at least ${min}` };
      }
      if (max !== undefined && num > max) {
        return { error: `Value must be at most ${max}` };
      }
      return { value: num };
    }

    case "CHECKBOX": {
      if (typeof value !== "boolean") {
        return { error: "Value must be true or false" };
      }
      return { value };
    }

    case "SINGLE_SELECT": {
      if (typeof value !== "string") {
        return { error: "Value must be a single option id" };
      }
      const options = field.config.options ?? [];
      if (!options.some((o) => o.id === value)) {
        return { error: "Not a valid option for this field" };
      }
      return { value };
    }

    case "MULTI_SELECT": {
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
        return { error: "Value must be a list of option ids" };
      }
      const options = field.config.options ?? [];
      const validIds = new Set(options.map((o) => o.id));
      if (!value.every((v) => validIds.has(v))) {
        return { error: "Not a valid option for this field" };
      }
      return { value };
    }

    case "DATE": {
      const date =
        typeof value === "string" || typeof value === "number"
          ? new Date(value)
          : null;
      if (!date || Number.isNaN(date.getTime())) {
        return { error: "Value must be a valid date" };
      }
      return { value: date.toISOString() };
    }

    case "PERSON": {
      if (typeof value !== "string") {
        return { error: "Value must be a user id" };
      }
      // Reuses the exact membership check addAssignee (app/actions/task-assignee.ts) already
      // performs — no new membership-checking logic.
      const membership = await getWorkspaceMembership(value, workspaceId);
      if (membership?.status !== "ACTIVE") {
        return { error: "User is not an active workspace member" };
      }
      return { value };
    }

    default:
      return { error: "Unsupported field type" };
  }
}
