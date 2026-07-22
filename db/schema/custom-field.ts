import { createId } from "@paralleldrive/cuid2";
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";
import { space } from "./space";
import { list } from "./list";
import { task } from "./task";

export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "TEXT",
  "NUMBER",
  "CHECKBOX",
  "SINGLE_SELECT",
  "MULTI_SELECT",
  "DATE",
  "PERSON",
]);

// Type-specific settings. Extended per field type without a migration — new
// keys just add optional fields here.
export interface CustomFieldConfig {
  // SINGLE_SELECT / MULTI_SELECT
  options?: { id: string; label: string; color?: string }[];
  // NUMBER
  min?: number;
  max?: number;
}

// Scope: workspaceId is always required; spaceId/listId narrow it. A field
// with both null applies workspace-wide; space-only (listId null) applies to
// every list in that space; both set applies to just that list. See
// getCustomFieldDefinitions() for how a list's applicable fields are
// resolved (a union across scopes, not an override chain).
export const customFieldDefinition = pgTable(
  "custom_field_definition",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    spaceId: text("space_id").references(() => space.id, { onDelete: "cascade" }),
    listId: text("list_id").references(() => list.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    placeholder: text("placeholder"),
    type: customFieldTypeEnum("type").notNull(),
    config: jsonb("config").$type<CustomFieldConfig>().notNull().default({}),
    // Validated against type/config by the same validator real values use
    // (lib/custom-fields/validation.ts) before being persisted.
    defaultValue: jsonb("default_value").$type<unknown>(),
    required: boolean("required").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("custom_field_definition_scope_idx").on(t.workspaceId, t.spaceId, t.listId),
    // Defense-in-depth backstop, not the sole guard — Postgres treats each
    // NULL as distinct, so this won't catch duplicate slugs across two
    // workspace-wide (spaceId/listId both null) fields. Real enforcement is
    // an app-level pre-insert duplicate check, same as tag_workspace_name_unique.
    unique("custom_field_definition_scope_slug_unique").on(
      t.workspaceId,
      t.spaceId,
      t.listId,
      t.slug,
    ),
  ],
);

// Generic jsonb value, not per-type typed columns — a fixed set of typed
// columns would need a migration the moment a future field type doesn't fit
// an existing slot, defeating the "new types without migrations" goal. Type
// safety instead lives in lib/custom-fields/validation.ts, applied on every
// write.
export const customFieldValue = pgTable(
  "custom_field_value",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    taskId: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    fieldId: text("field_id")
      .notNull()
      .references(() => customFieldDefinition.id, { onDelete: "cascade" }),
    value: jsonb("value").$type<unknown>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("custom_field_value_task_id_idx").on(t.taskId),
    unique("custom_field_value_task_field_unique").on(t.taskId, t.fieldId),
  ],
);
