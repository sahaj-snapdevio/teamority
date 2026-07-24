"use server";

import { and, asc, count, eq, inArray, isNull, max, or } from "drizzle-orm";
import { headers } from "next/headers";
import {
  type CustomFieldConfig,
  customFieldDefinition,
  customFieldValue,
} from "@/db/schema";
import { writeActivityLog } from "@/lib/activity-log";
import { auth } from "@/lib/auth";
import { validateCustomFieldValue } from "@/lib/custom-fields/validation";
import { db } from "@/lib/db";
import {
  getSpacePermission,
  getWorkspaceMembership,
  requireEditAccess,
  requireViewAccess,
} from "@/lib/permissions";
import { refreshWorkspace } from "@/lib/realtime/refresh";

export type CustomFieldRow = typeof customFieldDefinition.$inferSelect;

export type CustomFieldType =
  | "TEXT"
  | "NUMBER"
  | "CHECKBOX"
  | "SINGLE_SELECT"
  | "MULTI_SELECT"
  | "DATE"
  | "PERSON";

// ─── Permission helper ─────────────────────────────────────────────────────
// "Workspace/Space Admins" — mirrors list.ts's requireFullAccess for the
// equivalent "manage list statuses" admin action: space-scoped fields need
// full_access on that space (already folds in workspace OWNER/ADMIN); a
// workspace-wide field (no spaceId) needs true OWNER/ADMIN since there's no
// space to check permission against.
async function requireFieldAdmin(
  userId: string,
  workspaceId: string,
  spaceId: string | null
): Promise<{ error: string } | null> {
  if (spaceId) {
    const permission = await getSpacePermission(userId, workspaceId, spaceId);
    if (permission !== "full_access") {
      return { error: "You need Full Access to manage custom fields" };
    }
    return null;
  }
  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (
    !membership ||
    (membership.role !== "OWNER" && membership.role !== "ADMIN")
  ) {
    return {
      error:
        "You need to be a Workspace Admin to manage workspace-wide custom fields",
    };
  }
  return null;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function revalidate(
  workspaceId: string,
  spaceId: string | null,
  taskId?: string
) {
  void refreshWorkspace(
    workspaceId,
    spaceId
      ? [`/${workspaceId}/${spaceId}/settings/custom-fields`]
      : [`/${workspaceId}`],
    { taskId }
  );
}

// ─── Internal query (no auth — callers must check permission first) ────────
// Single source of truth for "which definitions apply here" — a union across
// scopes, not an override chain: list-scoped ∪ this-space-scoped (list null)
// ∪ workspace-wide (both null). Every reader below goes through this.
async function queryFieldDefinitions(
  workspaceId: string,
  spaceId: string | null,
  listId: string | null,
  includeArchived = false
) {
  const scopeOr = [];
  if (listId) {
    scopeOr.push(eq(customFieldDefinition.listId, listId));
  }
  if (spaceId) {
    scopeOr.push(
      and(
        isNull(customFieldDefinition.listId),
        eq(customFieldDefinition.spaceId, spaceId)
      )
    );
  }
  scopeOr.push(
    and(
      isNull(customFieldDefinition.listId),
      isNull(customFieldDefinition.spaceId)
    )
  );

  const conditions = [
    eq(customFieldDefinition.workspaceId, workspaceId),
    or(...scopeOr),
  ];
  if (!includeArchived) {
    conditions.push(eq(customFieldDefinition.isArchived, false));
  }

  return db
    .select()
    .from(customFieldDefinition)
    .where(and(...conditions))
    .orderBy(asc(customFieldDefinition.orderIndex));
}

async function getScopeOrderIndex(
  workspaceId: string,
  spaceId: string | null,
  listId: string | null
) {
  const conditions = [eq(customFieldDefinition.workspaceId, workspaceId)];
  conditions.push(
    spaceId
      ? eq(customFieldDefinition.spaceId, spaceId)
      : isNull(customFieldDefinition.spaceId)
  );
  conditions.push(
    listId
      ? eq(customFieldDefinition.listId, listId)
      : isNull(customFieldDefinition.listId)
  );
  const [row] = await db
    .select({ maxIdx: max(customFieldDefinition.orderIndex) })
    .from(customFieldDefinition)
    .where(and(...conditions));
  return (row?.maxIdx ?? 0) + 1000;
}

// ─── Definitions: read ───────────────────────────────────────────────────────

export async function getCustomFieldDefinitions(
  workspaceId: string,
  spaceId?: string | null,
  listId?: string | null,
  opts?: { includeArchived?: boolean }
): Promise<{ fields: CustomFieldRow[] } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorized" };
  }

  if (spaceId) {
    const permErr = await requireViewAccess(
      session.user.id,
      workspaceId,
      spaceId
    );
    if (permErr) {
      return permErr;
    }
  } else {
    const membership = await getWorkspaceMembership(
      session.user.id,
      workspaceId
    );
    if (!membership) {
      return { error: "Unauthorized" };
    }
  }

  const fields = await queryFieldDefinitions(
    workspaceId,
    spaceId ?? null,
    listId ?? null,
    opts?.includeArchived
  );
  return { fields };
}

// ─── Definitions: write ──────────────────────────────────────────────────────

export async function createCustomFieldDefinition(
  workspaceId: string,
  spaceId: string | null,
  listId: string | null,
  data: {
    config?: CustomFieldConfig;
    defaultValue?: unknown;
    description?: string;
    name: string;
    placeholder?: string;
    required?: boolean;
    type: CustomFieldType;
  }
): Promise<{ field: CustomFieldRow } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorized" };
  }

  const permErr = await requireFieldAdmin(
    session.user.id,
    workspaceId,
    spaceId
  );
  if (permErr) {
    return permErr;
  }

  if (listId && !spaceId) {
    return { error: "A list-scoped field must specify its space" };
  }

  const name = data.name.trim();
  if (!name) {
    return { error: "Field name is required" };
  }
  const slug = slugify(name);
  if (!slug) {
    return { error: "Field name must contain at least one letter or number" };
  }

  const scopeConditions = [
    eq(customFieldDefinition.workspaceId, workspaceId),
    spaceId
      ? eq(customFieldDefinition.spaceId, spaceId)
      : isNull(customFieldDefinition.spaceId),
    listId
      ? eq(customFieldDefinition.listId, listId)
      : isNull(customFieldDefinition.listId),
    eq(customFieldDefinition.slug, slug),
  ];
  const [existing] = await db
    .select({ id: customFieldDefinition.id })
    .from(customFieldDefinition)
    .where(and(...scopeConditions))
    .limit(1);
  if (existing) {
    return { error: "A field with this name already exists in this scope" };
  }

  const config = data.config ?? {};
  let defaultValue: unknown = null;
  if (data.defaultValue !== undefined && data.defaultValue !== null) {
    const result = await validateCustomFieldValue(
      { type: data.type, config },
      workspaceId,
      data.defaultValue
    );
    if ("error" in result) {
      return { error: `Default value: ${result.error}` };
    }
    defaultValue = result.value;
  }

  const orderIndex = await getScopeOrderIndex(workspaceId, spaceId, listId);

  const [field] = await db
    .insert(customFieldDefinition)
    .values({
      workspaceId,
      spaceId,
      listId,
      name,
      slug,
      description: data.description?.trim() || null,
      placeholder: data.placeholder?.trim() || null,
      type: data.type,
      config,
      defaultValue,
      required: data.required ?? false,
      orderIndex,
    })
    .returning();

  revalidate(workspaceId, spaceId);
  return { field };
}

export async function updateCustomFieldDefinition(
  workspaceId: string,
  fieldId: string,
  data: {
    config?: CustomFieldConfig;
    defaultValue?: unknown;
    description?: string | null;
    name?: string;
    placeholder?: string | null;
    required?: boolean;
  }
): Promise<{ ok: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorized" };
  }

  const [field] = await db
    .select()
    .from(customFieldDefinition)
    .where(
      and(
        eq(customFieldDefinition.id, fieldId),
        eq(customFieldDefinition.workspaceId, workspaceId)
      )
    )
    .limit(1);
  if (!field) {
    return { error: "Field not found" };
  }

  const permErr = await requireFieldAdmin(
    session.user.id,
    workspaceId,
    field.spaceId
  );
  if (permErr) {
    return permErr;
  }

  const updates: Partial<typeof customFieldDefinition.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) {
      return { error: "Field name is required" };
    }
    const slug = slugify(name);
    if (!slug) {
      return { error: "Field name must contain at least one letter or number" };
    }
    const [dup] = await db
      .select({ id: customFieldDefinition.id })
      .from(customFieldDefinition)
      .where(
        and(
          eq(customFieldDefinition.workspaceId, workspaceId),
          field.spaceId
            ? eq(customFieldDefinition.spaceId, field.spaceId)
            : isNull(customFieldDefinition.spaceId),
          field.listId
            ? eq(customFieldDefinition.listId, field.listId)
            : isNull(customFieldDefinition.listId),
          eq(customFieldDefinition.slug, slug)
        )
      )
      .limit(1);
    if (dup && dup.id !== fieldId) {
      return { error: "A field with this name already exists in this scope" };
    }
    updates.name = name;
    updates.slug = slug;
  }
  if (data.description !== undefined) {
    updates.description = data.description;
  }
  if (data.placeholder !== undefined) {
    updates.placeholder = data.placeholder;
  }
  if (data.config !== undefined) {
    updates.config = data.config;
  }
  if (data.required !== undefined) {
    updates.required = data.required;
  }
  if (data.defaultValue !== undefined) {
    if (data.defaultValue === null) {
      updates.defaultValue = null;
    } else {
      const config = data.config ?? field.config;
      const result = await validateCustomFieldValue(
        { type: field.type, config },
        workspaceId,
        data.defaultValue
      );
      if ("error" in result) {
        return { error: `Default value: ${result.error}` };
      }
      updates.defaultValue = result.value;
    }
  }

  await db
    .update(customFieldDefinition)
    .set(updates)
    .where(eq(customFieldDefinition.id, fieldId));
  revalidate(workspaceId, field.spaceId);
  return { ok: true };
}

async function setArchived(
  workspaceId: string,
  fieldId: string,
  isArchived: boolean
): Promise<{ ok: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorized" };
  }

  const [field] = await db
    .select({ spaceId: customFieldDefinition.spaceId })
    .from(customFieldDefinition)
    .where(
      and(
        eq(customFieldDefinition.id, fieldId),
        eq(customFieldDefinition.workspaceId, workspaceId)
      )
    )
    .limit(1);
  if (!field) {
    return { error: "Field not found" };
  }

  const permErr = await requireFieldAdmin(
    session.user.id,
    workspaceId,
    field.spaceId
  );
  if (permErr) {
    return permErr;
  }

  await db
    .update(customFieldDefinition)
    .set({
      isArchived,
      archivedAt: isArchived ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(customFieldDefinition.id, fieldId));

  revalidate(workspaceId, field.spaceId);
  return { ok: true as const };
}

// Archive hides a field while keeping its stored values — the reversible,
// default removal path. deleteCustomFieldDefinition (below) is the separate,
// permanent path for when a field truly needs to go.
export async function archiveCustomFieldDefinition(
  workspaceId: string,
  fieldId: string
): Promise<{ ok: true } | { error: string }> {
  return setArchived(workspaceId, fieldId, true);
}

export async function unarchiveCustomFieldDefinition(
  workspaceId: string,
  fieldId: string
): Promise<{ ok: true } | { error: string }> {
  return setArchived(workspaceId, fieldId, false);
}

// How many tasks currently hold a value for this field — i.e. exactly what
// deleteCustomFieldDefinition below would destroy. Read by the delete
// confirmation dialog so the blast radius is stated before it happens.
export async function getCustomFieldValueCount(
  workspaceId: string,
  fieldId: string
): Promise<{ count: number } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorized" };
  }

  const [field] = await db
    .select({ spaceId: customFieldDefinition.spaceId })
    .from(customFieldDefinition)
    .where(
      and(
        eq(customFieldDefinition.id, fieldId),
        eq(customFieldDefinition.workspaceId, workspaceId)
      )
    )
    .limit(1);
  if (!field) {
    return { error: "Field not found" };
  }

  const permErr = await requireFieldAdmin(
    session.user.id,
    workspaceId,
    field.spaceId
  );
  if (permErr) {
    return permErr;
  }

  const [row] = await db
    .select({ value: count() })
    .from(customFieldValue)
    .where(eq(customFieldValue.fieldId, fieldId));

  return { count: row?.value ?? 0 };
}

// Permanent removal, unlike archive above. customFieldValue.fieldId is
// declared `onDelete: "cascade"` (db/schema/custom-field.ts), so deleting the
// definition row here also removes every stored value for it — no separate
// cleanup query needed.
export async function deleteCustomFieldDefinition(
  workspaceId: string,
  fieldId: string
): Promise<{ ok: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorized" };
  }

  const [field] = await db
    .select({ spaceId: customFieldDefinition.spaceId })
    .from(customFieldDefinition)
    .where(
      and(
        eq(customFieldDefinition.id, fieldId),
        eq(customFieldDefinition.workspaceId, workspaceId)
      )
    )
    .limit(1);
  if (!field) {
    return { error: "Field not found" };
  }

  const permErr = await requireFieldAdmin(
    session.user.id,
    workspaceId,
    field.spaceId
  );
  if (permErr) {
    return permErr;
  }

  await db
    .delete(customFieldDefinition)
    .where(eq(customFieldDefinition.id, fieldId));

  revalidate(workspaceId, field.spaceId);
  return { ok: true as const };
}

// Mirrors reorderListStatuses (app/actions/list.ts) exactly.
export async function reorderCustomFieldDefinitions(
  workspaceId: string,
  spaceId: string | null,
  orderedIds: string[]
): Promise<{ ok: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorized" };
  }

  const permErr = await requireFieldAdmin(
    session.user.id,
    workspaceId,
    spaceId
  );
  if (permErr) {
    return permErr;
  }

  await db.transaction(async (tx) => {
    await Promise.all(
      orderedIds.map((id, i) =>
        tx
          .update(customFieldDefinition)
          .set({ orderIndex: (i + 1) * 1000, updatedAt: new Date() })
          .where(
            and(
              eq(customFieldDefinition.id, id),
              eq(customFieldDefinition.workspaceId, workspaceId)
            )
          )
      )
    );
  });

  revalidate(workspaceId, spaceId);
  return { ok: true };
}

// ─── Values ───────────────────────────────────────────────────────────────
// The primary read entry point for consumers (future List/Board/task-detail
// loaders): exactly 2 queries total regardless of how many tasks are passed
// — one for the applicable definitions, one batched value query — merged
// into a per-task map, falling back to each field's defaultValue.

export async function getCustomFieldsForTasks(
  workspaceId: string,
  spaceId: string,
  listId: string | null,
  taskIds: string[]
): Promise<
  | {
      fields: CustomFieldRow[];
      valuesByTask: Record<string, Record<string, unknown>>;
    }
  | { error: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorized" };
  }

  const permErr = await requireViewAccess(
    session.user.id,
    workspaceId,
    spaceId
  );
  if (permErr) {
    return permErr;
  }

  const fields = await queryFieldDefinitions(workspaceId, spaceId, listId);

  const valuesByTask: Record<string, Record<string, unknown>> = {};
  for (const taskId of taskIds) {
    valuesByTask[taskId] = Object.fromEntries(
      fields.map((f) => [f.id, f.defaultValue ?? null])
    );
  }

  if (taskIds.length > 0 && fields.length > 0) {
    const rows = await db
      .select({
        taskId: customFieldValue.taskId,
        fieldId: customFieldValue.fieldId,
        value: customFieldValue.value,
      })
      .from(customFieldValue)
      .where(inArray(customFieldValue.taskId, taskIds));
    for (const row of rows) {
      valuesByTask[row.taskId] ??= {};
      valuesByTask[row.taskId][row.fieldId] = row.value;
    }
  }

  return { fields, valuesByTask };
}

export async function setCustomFieldValue(
  workspaceId: string,
  spaceId: string,
  taskId: string,
  fieldId: string,
  value: unknown
): Promise<{ ok: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorized" };
  }

  const permErr = await requireEditAccess(
    session.user.id,
    workspaceId,
    spaceId
  );
  if (permErr) {
    return permErr;
  }

  const [field] = await db
    .select()
    .from(customFieldDefinition)
    .where(
      and(
        eq(customFieldDefinition.id, fieldId),
        eq(customFieldDefinition.workspaceId, workspaceId)
      )
    )
    .limit(1);
  if (!field) {
    return { error: "Field not found" };
  }
  if (field.isArchived) {
    return { error: "This field is archived" };
  }
  if (field.required && (value === null || value === undefined)) {
    return { error: `${field.name} is required` };
  }

  const result = await validateCustomFieldValue(field, workspaceId, value);
  if ("error" in result) {
    return result;
  }

  await db
    .insert(customFieldValue)
    .values({ taskId, fieldId, value: result.value })
    .onConflictDoUpdate({
      target: [customFieldValue.taskId, customFieldValue.fieldId],
      set: { value: result.value, updatedAt: new Date() },
    });

  await writeActivityLog(taskId, session.user.id, "custom_field_value_set", {
    fieldId,
    fieldName: field.name,
  });

  revalidate(workspaceId, spaceId, taskId);
  return { ok: true };
}

export async function deleteCustomFieldValue(
  workspaceId: string,
  spaceId: string,
  taskId: string,
  fieldId: string
): Promise<{ ok: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorized" };
  }

  const permErr = await requireEditAccess(
    session.user.id,
    workspaceId,
    spaceId
  );
  if (permErr) {
    return permErr;
  }

  const [field] = await db
    .select({
      name: customFieldDefinition.name,
      required: customFieldDefinition.required,
    })
    .from(customFieldDefinition)
    .where(
      and(
        eq(customFieldDefinition.id, fieldId),
        eq(customFieldDefinition.workspaceId, workspaceId)
      )
    )
    .limit(1);
  if (field?.required) {
    return { error: `${field.name} is required and cannot be cleared` };
  }

  await db
    .delete(customFieldValue)
    .where(
      and(
        eq(customFieldValue.taskId, taskId),
        eq(customFieldValue.fieldId, fieldId)
      )
    );

  await writeActivityLog(
    taskId,
    session.user.id,
    "custom_field_value_cleared",
    {
      fieldId,
      fieldName: field?.name,
    }
  );

  revalidate(workspaceId, spaceId, taskId);
  return { ok: true };
}
