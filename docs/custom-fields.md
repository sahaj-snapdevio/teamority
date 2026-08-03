# Custom Fields

## Overview

Custom Fields let a workspace or project define extra task properties beyond the built-in ones (Status, Priority, Assignee, Due Date). Each field has a **type** (Text, Number, Checkbox, Single Select, Multi Select, Date, Person) and a **scope** (workspace-wide, a single Project, or a single List).

**Hierarchy position:** a Custom Field Definition lives at whichever scope it was created for; values live on individual Tasks.

```
Workspace
  └── Project (Space)
        ├── Custom Field Definition (spaceId set, listId null)  ← most common
        │     └── List
        │           └── Custom Field Definition (spaceId + listId set) — narrowest scope
        └── Task
              └── Custom Field Value (one per field per task)
```

A workspace-wide field (both `spaceId`/`listId` null) applies everywhere; a space-scoped field applies to every List in that Project; a list-scoped field applies to just that List. Resolving "which fields apply here" is a **union across scopes**, not an override chain — see `queryFieldDefinitions()` in `app/actions/custom-field.ts`.

Today, field management (create/edit/archive/delete/reorder) is built out for **Project-scoped fields** via **Project Settings → Custom Fields**. Workspace-wide and list-scoped fields are fully supported by the backend/schema but have no dedicated settings UI yet.

---

## Field Types

| Type | Stored value | Notes |
|------|--------------|-------|
| **Text** | string | Optional placeholder text |
| **Number** | number | Optional `min`/`max` in `config` |
| **Checkbox** | boolean | |
| **Single Select** | option id (string) | Options are `{ id, label, color? }[]` in `config.options` |
| **Multi Select** | option ids (string[]) | Same `config.options` shape as Single Select |
| **Date** | ISO date string | |
| **Person** | workspace member userId | |

A field's **type cannot be changed after creation** — the Edit form disables the Type select and shows a note explaining why (changing type would invalidate existing values/config). To get a different type, archive/delete the field and create a new one.

---

## Definition Properties

- **Name** — required; a `slug` is derived from it (`slugify()` in `app/actions/custom-field.ts`) and must be unique within the same scope (workspace + spaceId + listId).
- **Description** — optional, informational only.
- **Placeholder** — optional, shown in empty value editors.
- **Config** — type-specific settings (`options` for selects, `min`/`max` for Number).
- **Default value** — validated through the same `validateCustomFieldValue()` every real value goes through (`lib/custom-fields/validation.ts`) before being stored. Falls back into a task's value whenever no explicit value has been set yet (`getCustomFieldsForTasks()`).
- **Required** — enforced on `setCustomFieldValue()`; a required field's value cannot be cleared via `deleteCustomFieldValue()`.
- **Order** — `orderIndex`, reordered within a scope via drag-and-drop in the settings page (see below).

⚠️ **Known limitation:** editing a Single/Multi Select field's options is a free-text "comma separated" input that regenerates option ids by re-slugifying each label. Renaming an option's label therefore changes its id/slug — any task values already pointing at the old id become orphaned (not automatically migrated). This mirrors the original create-flow behavior; a real fix needs a per-option editor that preserves ids across renames.

---

## Archive vs. Delete

Two distinct, separate removal paths — do not conflate them:

| | Archive | Delete |
|---|---|---|
| Reversible? | Yes — Unarchive restores it | No — permanent |
| Stored values | Kept | Removed (cascade) |
| Where a field shows | Hidden from List/Board/Filters/Columns | Gone entirely |
| Action | `archiveCustomFieldDefinition` / `unarchiveCustomFieldDefinition` | `deleteCustomFieldDefinition` |

`customFieldValue.fieldId` has `onDelete: "cascade"` (`db/schema/custom-field.ts`), so `deleteCustomFieldDefinition` only needs to delete the definition row — every value for it is removed automatically, no separate cleanup query.

Delete requires a confirmation dialog (`Dialog`, not `window.confirm`) — see the "Confirmation Dialogs" pattern in the root `CLAUDE.md`. Copy:
> Delete "{field name}"?
> This will permanently delete the field and remove all stored values from every task. This action cannot be undone.

---

## Permissions

`requireFieldAdmin()` (`app/actions/custom-field.ts`) gates every write action:

- **Space-scoped field** (has a `spaceId`) — the acting user needs **Full Access** on that Space (`getSpacePermission(...) === "full_access"`).
- **Workspace-wide field** (no `spaceId`) — the acting user needs to be a **Workspace Owner or Admin** (there's no space to check permission against).

The List/Board toolbar's discoverability shortcut (below) reuses the page-level `canManage` flag (`spacePermission === "full_access"`, computed once in `page.tsx`) — the same condition `requireFieldAdmin` enforces for a space-scoped field, so the shortcut only appears for users who can actually use it.

---

## Project Settings → Custom Fields

Route: `/{workspaceId}/{spaceId}/settings/custom-fields` (`app/(app)/[workspaceId]/[spaceId]/settings/custom-fields/page.tsx`, component `components/space/custom-fields-settings.tsx`).

- **Search** — filters the field list by name (client-side).
- **Show archived** — toggles whether archived fields appear (dimmed, at the end).
- **Table columns** — Field Name, **Type** (icon + label per the table above), **Required** (a "Required"/"Optional" pill badge, not plain Yes/No text).
- **Reordering** — a drag handle (`⋮⋮`, `@dnd-kit`) on each non-archived row, same pattern as `components/list/list-statuses-settings.tsx`. Dragging reorders within the non-archived subset and persists via `reorderCustomFieldDefinitions`. Archived fields keep whatever `orderIndex` they had when archived and aren't draggable.
- **Row actions** — a quick Edit (pencil) icon plus a `⋯` overflow menu (Edit / Archive-or-Unarchive / Delete, destructive Delete below a divider).
- **Create / Edit** — a single shared dialog (`FieldFormDialog`) handles both; Edit pre-fills every field and disables the Type select. Default-value editors exist for Text/Number/Checkbox/Date/Single/Multi Select; **Person default value is intentionally not supported yet** (would need a members list this page doesn't currently fetch).
- **Empty state** — when zero fields exist at all: icon + "No custom fields yet" + "Create your first custom field." + a Create Field button (not a bare empty table).

---

## List / Board Toolbar Integration

Three toolbar controls read/write Custom Fields, all gated on `customFields` already being loaded per-page (non-archived only, via `queryFieldDefinitions(..., includeArchived: false)`):

### Columns (List View only)
Show/hide which custom-field columns appear in the table. Built-in columns (Assignee, Due Date, Priority) are listed for context as plain, read-only muted rows — no show/hide exists for them yet, so no fake checkboxes. Custom fields are:
- searchable (`Search columns…`, filters the Custom Fields section only — built-ins always stay visible),
- sorted alphabetically for display (storage order is untouched),
- rendered in a height-capped, scrollable list (`~220px`) so the popup doesn't grow unbounded with many fields — the search box and footer stay fixed above/below it.
- Footer is "Clear Selection" with a divider above it, not a bare "Clear".

Hidden entirely when there are zero custom fields (`columnOptions.length > 0`).

### Filters
The `Filters` button (`components/filters/filter-builder.tsx`) is **custom-fields only** — Status/Priority/Assignee already have their own dedicated toolbar buttons and are deliberately excluded here to avoid duplicating them. **Hidden entirely when the project has no active custom fields** (`filterFields.length > 0`) — a Filters button with nothing to filter is confusing UI, not a helpful one. Its own "Add filter" picker has a search box (`Search fields…`) for scanning many fields.

### Manage Custom Fields (shortcut)
A small icon-only button (`components/common/manage-fields-icon.tsx` — a composited Table + PlusCircle badge, since Phosphor has no single "add field" glyph) placed immediately after Columns, before Archived. Navigates straight to Project Settings → Custom Fields. Exists specifically because Filters/Columns disappearing at zero fields left users with **no way to discover where fields are managed** — this shortcut is shown regardless of field count (that's the point), gated only on the `canManage` permission described above. It is not a general Settings button.

Both List View and Board View toolbars group these (and Sort/Group By/Archived) with a thin vertical divider (`mx-1 h-5 w-px shrink-0 bg-border`, the same pattern already used in `search-palette.tsx`/`attachment-preview-modal.tsx`) between logical clusters:
```
Search | Status  Priority  Assignee  Filters | Sort  Group By  Columns | Manage Fields  Archived
```
(Board View has no Group By/Archived — its middle cluster is just Sort + Fields, and the last cluster is just Manage Fields.)

---

## Shared Components Touched

- **`FacetOptionList`** (`components/filters/facet-filter.tsx`) gained optional, backward-compatible props used by the Columns/Add-filter pickers above: `searchPlaceholder`, `clearLabel`, `showClearDivider`, `maxListHeight`. Every other existing caller (Assignee/Person/Single/Multi-select filters, search palette, etc.) is unaffected — they don't pass these props, so they keep their original look.
- **`CustomFieldFilterControl`** (`components/filters/custom-field-filter.tsx`) renders the actual filter condition editor (operator + value) for each field type inside the Filters picker — reused verbatim from before, unchanged today.
- **`CustomFieldEditor`** (`components/task/custom-field-editors.tsx`) is the per-type inline value editor used on tasks (List/Board cells, Task Detail) — unchanged today; the Settings page's default-value editors are separate, simpler, form-oriented controls (not this component), since `CustomFieldEditor` expects a real, persisted field id.

---

## Server Actions (`app/actions/custom-field.ts`)

| Action | Purpose |
|---|---|
| `getCustomFieldDefinitions` | Read definitions for a workspace/space/list scope |
| `createCustomFieldDefinition` | Create — validates name/slug uniqueness per scope, validates `defaultValue` |
| `updateCustomFieldDefinition` | Edit — name/description/placeholder/config/required/defaultValue (not type) |
| `archiveCustomFieldDefinition` / `unarchiveCustomFieldDefinition` | Reversible hide/restore |
| `deleteCustomFieldDefinition` | Permanent — cascades to `customFieldValue` |
| `reorderCustomFieldDefinitions` | Persist drag-and-drop order (non-archived subset) |
| `getCustomFieldsForTasks` | Batched read: definitions + values for a set of tasks, falling back to `defaultValue` |
| `setCustomFieldValue` / `deleteCustomFieldValue` | Read/write a single task's value for one field |

Every write calls `refreshWorkspace()` per the Real-time Sync convention in the root `CLAUDE.md`.

---

## Out of Scope (for now)

- A dedicated settings UI for workspace-wide or list-scoped fields (backend/schema already support both).
- A non-lossy options editor for Single/Multi Select (see the "Known limitation" above).
- Default value editing for Person fields.
- Sort-by-custom-field, Group-by-custom-field.
- Bulk edit / bulk apply a value across many tasks.
