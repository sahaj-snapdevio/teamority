"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessSpace, getAccessibleSpaceIds } from "@/lib/permissions";
import {
  task,
  taskAssignee,
  list,
  space,
  listStatus,
  workspaceMember,
  userSearchHistory,
  savedFilter,
  sprint,
  tag,
  taskTag,
  user,
} from "@/db/schema";
import { eq, and, ilike, or, inArray, desc, isNull, type SQL } from "drizzle-orm";
import { buildTaskFilterConditions } from "@/lib/filters/task-conditions";
import {
  hasActiveFilters,
  type GlobalSearchFilters,
} from "@/lib/filters/options";

// ─── Global Search ──────────────────────────────────────────────────────────

export type SearchTaskResult = {
  id: string;
  title: string;
  seqNumber: number;
  priority: string;
  statusId: string | null;
  statusName: string | null;
  statusColor: string | null;
  statusType: string | null;
  listId: string | null;
  listName: string | null;
  spaceId: string;
  spaceName: string;
  dueDateEnd: Date | null;
  isArchived: boolean;
  assignees: { userId: string; name: string | null; email: string | null }[];
};

export type SearchListResult = {
  id: string;
  name: string;
  spaceId: string;
  spaceName: string;
};

export type SearchSpaceResult = {
  id: string;
  name: string;
  color: string | null;
  memberCount: number;
  isArchived: boolean;
};

export type SearchMemberResult = {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
};

export type GlobalSearchResults = {
  tasks: SearchTaskResult[];
  lists: SearchListResult[];
  spaces: SearchSpaceResult[];
  members: SearchMemberResult[];
};

export async function globalSearch(
  workspaceId: string,
  query: string,
  filters?: GlobalSearchFilters,
): Promise<GlobalSearchResults | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const trimmed = query.trim();
  const hasText = trimmed.length >= 2;
  const filtersActive = hasActiveFilters(filters);

  const empty: GlobalSearchResults = { tasks: [], lists: [], spaces: [], members: [] };

  // Run when there's a text query OR at least one active filter (filter-only
  // search, e.g. "assigned to John" with no text). Otherwise nothing to do.
  if (!hasText && !filtersActive) return empty;

  const accessibleSpaceIds = await getAccessibleSpaceIds(
    session.user.id,
    workspaceId,
  );
  if (accessibleSpaceIds.length === 0) return empty;

  const q = `%${trimmed}%`;
  const type = filters?.type ?? "all";
  const wantTasks = type === "all" || type === "tasks";
  // Lists / spaces / members have no structured filters, so a filter-only search
  // (no text) returns tasks only — they require a text query.
  const wantLists = hasText && (type === "all" || type === "lists");
  const wantSpaces = hasText && (type === "all" || type === "spaces");
  const wantMembers = hasText && (type === "all" || type === "members");

  // ── Tasks ──────────────────────────────────────────────────────────────
  let tasks: SearchTaskResult[] = [];
  if (wantTasks) {
    const conditions: SQL[] = [
      eq(task.workspaceId, workspaceId),
      isNull(task.parentTaskId),
      eq(list.isArchived, false),
      inArray(space.id, accessibleSpaceIds),
    ];
    if (hasText) conditions.push(ilike(task.title, q));
    if (filters?.space?.length) conditions.push(inArray(space.id, filters.space));
    // status(type)/priority/due/assignee/tags/sprint via the shared builder.
    conditions.push(...buildTaskFilterConditions(filters ?? {}));

    const taskRows = await db
      .select({
        id: task.id,
        title: task.title,
        seqNumber: task.seqNumber,
        priority: task.priority,
        statusId: task.statusId,
        statusName: listStatus.name,
        statusColor: listStatus.color,
        statusType: listStatus.type,
        listId: list.id,
        listName: list.name,
        spaceId: space.id,
        spaceName: space.name,
        dueDateEnd: task.dueDateEnd,
        isArchived: task.isArchived,
      })
      .from(task)
      .innerJoin(list, eq(task.listId, list.id))
      .innerJoin(space, eq(list.spaceId, space.id))
      .innerJoin(listStatus, eq(task.statusId, listStatus.id))
      .where(and(...conditions))
      .orderBy(desc(task.updatedAt))
      .limit(25);

    // Fetch assignees for found tasks (batched — no N+1).
    const taskIds = taskRows.map((t) => t.id);
    const assigneeMap: Record<string, { userId: string; name: string | null; email: string | null }[]> = {};
    if (taskIds.length > 0) {
      const assigneeRows = await db
        .select({
          taskId: taskAssignee.taskId,
          userId: taskAssignee.userId,
          name: user.name,
          email: user.email,
        })
        .from(taskAssignee)
        .innerJoin(user, eq(taskAssignee.userId, user.id))
        .where(inArray(taskAssignee.taskId, taskIds));

      for (const row of assigneeRows) {
        if (!assigneeMap[row.taskId]) assigneeMap[row.taskId] = [];
        assigneeMap[row.taskId].push({ userId: row.userId, name: row.name, email: row.email });
      }
    }

    tasks = taskRows.map((t) => ({
      ...t,
      assignees: assigneeMap[t.id] ?? [],
    }));
  }

  // ── Lists ──────────────────────────────────────────────────────────────
  let listRows: SearchListResult[] = [];
  if (wantLists) {
    listRows = await db
      .select({
        id: list.id,
        name: list.name,
        spaceId: space.id,
        spaceName: space.name,
      })
      .from(list)
      .innerJoin(space, eq(list.spaceId, space.id))
      .where(
        and(
          inArray(list.spaceId, accessibleSpaceIds),
          eq(list.isArchived, false),
          ilike(list.name, q),
        ),
      )
      .limit(10);
  }

  // ── Spaces (Projects) ──────────────────────────────────────────────────
  // Archived projects are searchable too — `accessibleSpaceIds` only carries
  // non-archived spaces, so the archived ones the user can access are fetched
  // separately here (not needed for tasks/lists, which stay scoped to active
  // spaces per docs/search-and-filters.md § Business Rules #2).
  let spaceRows: { id: string; name: string; color: string | null; isArchived: boolean }[] = [];
  if (wantSpaces) {
    const archivedSpaceIds = await getAccessibleSpaceIds(
      session.user.id,
      workspaceId,
      true,
    );
    spaceRows = await db
      .select({ id: space.id, name: space.name, color: space.color, isArchived: space.isArchived })
      .from(space)
      .where(
        and(
          eq(space.workspaceId, workspaceId),
          inArray(space.id, [...accessibleSpaceIds, ...archivedSpaceIds]),
          ilike(space.name, q),
        ),
      )
      .limit(10);
  }

  // ── Members ────────────────────────────────────────────────────────────
  let memberRows: { userId: string | null; name: string | null; email: string | null; role: string }[] = [];
  if (wantMembers) {
    memberRows = await db
      .select({
        userId: workspaceMember.userId,
        name: user.name,
        email: workspaceMember.email,
        role: workspaceMember.role,
      })
      .from(workspaceMember)
      .leftJoin(user, eq(workspaceMember.userId, user.id))
      .where(
        and(
          eq(workspaceMember.workspaceId, workspaceId),
          or(ilike(user.name, q), ilike(workspaceMember.email, q)),
        ),
      )
      .limit(10);
  }

  return {
    tasks,
    lists: listRows,
    spaces: spaceRows.map((s) => ({ ...s, memberCount: 0 })),
    members: memberRows.map((m) => ({
      userId: m.userId ?? "",
      name: m.name,
      email: m.email,
      role: m.role,
    })),
  };
}

// ─── Recent Search History ───────────────────────────────────────────────────

export async function getRecentSearches(
  workspaceId: string,
): Promise<{ entityType: string; entityId: string; visitedAt: Date }[] | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const rows = await db
    .select({
      entityType: userSearchHistory.entityType,
      entityId: userSearchHistory.entityId,
      visitedAt: userSearchHistory.visitedAt,
    })
    .from(userSearchHistory)
    .where(
      and(
        eq(userSearchHistory.userId, session.user.id),
        eq(userSearchHistory.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(userSearchHistory.visitedAt))
    .limit(5);

  return rows;
}

export async function recordSearchVisit(
  workspaceId: string,
  entityType: "task" | "list" | "space" | "member",
  entityId: string,
): Promise<void | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;

  // Delete existing entry for this entity (upsert via delete + insert)
  await db
    .delete(userSearchHistory)
    .where(
      and(
        eq(userSearchHistory.userId, userId),
        eq(userSearchHistory.workspaceId, workspaceId),
        eq(userSearchHistory.entityType, entityType),
        eq(userSearchHistory.entityId, entityId),
      ),
    );

  await db.insert(userSearchHistory).values({
    id: crypto.randomUUID(),
    userId,
    workspaceId,
    entityType,
    entityId,
    visitedAt: new Date(),
  });

  // Trim to last 20 entries
  const all = await db
    .select({ id: userSearchHistory.id })
    .from(userSearchHistory)
    .where(
      and(
        eq(userSearchHistory.userId, userId),
        eq(userSearchHistory.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(userSearchHistory.visitedAt));

  if (all.length > 20) {
    const toDelete = all.slice(20).map((r) => r.id);
    await db.delete(userSearchHistory).where(inArray(userSearchHistory.id, toDelete));
  }
}

// ─── Saved Filters ───────────────────────────────────────────────────────────

export type SavedFilterRow = {
  id: string;
  name: string;
  filters: unknown;
  createdAt: Date;
};

export async function getSavedFilters(
  listId: string,
): Promise<SavedFilterRow[] | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const rows = await db
    .select({ id: savedFilter.id, name: savedFilter.name, filters: savedFilter.filters, createdAt: savedFilter.createdAt })
    .from(savedFilter)
    .where(and(eq(savedFilter.userId, session.user.id), eq(savedFilter.listId, listId)))
    .orderBy(savedFilter.createdAt);

  return rows;
}

export async function createSavedFilter(
  listId: string,
  name: string,
  filters: object,
): Promise<{ id: string } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;

  const count = await db
    .select({ id: savedFilter.id })
    .from(savedFilter)
    .where(and(eq(savedFilter.userId, userId), eq(savedFilter.listId, listId)));

  if (count.length >= 10) {
    return { error: "Saved filter limit reached (10 per list). Delete one to save a new filter." };
  }

  const id = crypto.randomUUID();
  await db.insert(savedFilter).values({
    id,
    userId,
    listId,
    name,
    filters,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { id };
}

export async function renameSavedFilter(
  filterId: string,
  name: string,
): Promise<void | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const rows = await db
    .select({ userId: savedFilter.userId })
    .from(savedFilter)
    .where(eq(savedFilter.id, filterId));

  if (!rows[0] || rows[0].userId !== session.user.id) {
    return { error: "Not found" };
  }

  await db
    .update(savedFilter)
    .set({ name, updatedAt: new Date() })
    .where(eq(savedFilter.id, filterId));
}

export async function deleteSavedFilter(
  filterId: string,
): Promise<void | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const rows = await db
    .select({ userId: savedFilter.userId })
    .from(savedFilter)
    .where(eq(savedFilter.id, filterId));

  if (!rows[0] || rows[0].userId !== session.user.id) {
    return { error: "Not found" };
  }

  await db.delete(savedFilter).where(eq(savedFilter.id, filterId));
}

// ─── List Tasks with Filters ─────────────────────────────────────────────────

export type FilterState = {
  status?: string[];
  priority?: string[];
  assignee?: string[];
  due?: "overdue" | "today" | "this_week" | "no_due_date" | "";
  tags?: string[];
};

export async function getFilteredTasks(
  workspaceId: string,
  spaceId: string,
  listId: string,
  filters: FilterState,
): Promise<
  | {
      id: string;
      title: string;
      seqNumber: number;
      priority: string;
      statusId: string | null;
      dueDateEnd: Date | null;
      orderIndex: number;
      tags: { id: string; name: string; color: string }[];
      assignees: { userId: string; name: string | null; image: string | null }[];
    }[]
  | { error: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const accessible = await canAccessSpace(session.user.id, workspaceId, spaceId);
  if (!accessible) return { error: "Forbidden" };

  // Base list scope + the shared filter conditions (status/priority/due, plus
  // assignee/tags now applied in SQL via the same builder the omnibox uses).
  const conditions: SQL[] = [
    eq(task.listId, listId),
    eq(task.isArchived, false),
    isNull(task.parentTaskId),
    ...buildTaskFilterConditions(filters),
  ];

  const taskRows = await db
    .select({
      id: task.id,
      title: task.title,
      seqNumber: task.seqNumber,
      priority: task.priority,
      statusId: task.statusId,
      dueDateEnd: task.dueDateEnd,
      orderIndex: task.orderIndex,
    })
    .from(task)
    .where(and(...conditions))
    .orderBy(task.orderIndex);

  if (taskRows.length === 0) return [];

  const ids = taskRows.map((t) => t.id);

  // Fetch tags
  const tagRows = await db
    .select({ taskId: taskTag.taskId, id: tag.id, name: tag.name, color: tag.color })
    .from(taskTag)
    .innerJoin(tag, eq(taskTag.tagId, tag.id))
    .where(inArray(taskTag.taskId, ids));

  // Fetch assignees
  const assigneeRows = await db
    .select({ taskId: taskAssignee.taskId, userId: taskAssignee.userId, name: user.name, image: user.image })
    .from(taskAssignee)
    .innerJoin(user, eq(taskAssignee.userId, user.id))
    .where(inArray(taskAssignee.taskId, ids));

  // Build maps
  const tagMap: Record<string, { id: string; name: string; color: string }[]> = {};
  for (const r of tagRows) {
    if (!tagMap[r.taskId]) tagMap[r.taskId] = [];
    tagMap[r.taskId].push({ id: r.id, name: r.name, color: r.color });
  }

  const assigneeMap: Record<string, { userId: string; name: string | null; image: string | null }[]> = {};
  for (const r of assigneeRows) {
    if (!assigneeMap[r.taskId]) assigneeMap[r.taskId] = [];
    assigneeMap[r.taskId].push({ userId: r.userId, name: r.name, image: r.image ?? null });
  }

  // Assignee/tags are already applied in SQL (see buildTaskFilterConditions);
  // here we only attach the fetched tags/assignees for display.
  const results = taskRows.map((t) => ({
    ...t,
    tags: tagMap[t.id] ?? [],
    assignees: assigneeMap[t.id] ?? [],
  }));

  return results;
}

// ─── Search Filter Options ───────────────────────────────────────────────────

export type SearchFilterOptions = {
  spaces: { id: string; name: string; color: string | null }[];
  members: { userId: string; name: string | null; email: string | null; image: string | null }[];
  tags: { id: string; name: string; color: string }[];
  sprints: { id: string; name: string; spaceId: string; status: string }[];
};

/**
 * Option lists for the global-search filter pickers, scoped to the spaces the
 * user can access. Priority / status-bucket / type options are static constants
 * on the client (see lib/filters/options.ts) — only the data-driven lists live
 * here. Reuses the same `getAccessibleSpaceIds` scoping as globalSearch.
 */
export async function getSearchFilterOptions(
  workspaceId: string,
): Promise<SearchFilterOptions | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const accessibleSpaceIds = await getAccessibleSpaceIds(
    session.user.id,
    workspaceId,
  );
  if (accessibleSpaceIds.length === 0) {
    return { spaces: [], members: [], tags: [], sprints: [] };
  }

  const [spaces, memberRows, tags, sprints] = await Promise.all([
    db
      .select({ id: space.id, name: space.name, color: space.color })
      .from(space)
      .where(
        and(
          eq(space.workspaceId, workspaceId),
          inArray(space.id, accessibleSpaceIds),
          eq(space.isArchived, false),
        ),
      )
      .orderBy(space.orderIndex),
    db
      .select({
        userId: workspaceMember.userId,
        name: user.name,
        email: workspaceMember.email,
        image: user.image,
      })
      .from(workspaceMember)
      .leftJoin(user, eq(workspaceMember.userId, user.id))
      .where(
        and(
          eq(workspaceMember.workspaceId, workspaceId),
          eq(workspaceMember.status, "ACTIVE"),
        ),
      ),
    db
      .select({ id: tag.id, name: tag.name, color: tag.color })
      .from(tag)
      .where(eq(tag.workspaceId, workspaceId))
      .orderBy(tag.name),
    db
      .select({
        id: sprint.id,
        name: sprint.name,
        spaceId: sprint.spaceId,
        status: sprint.status,
      })
      .from(sprint)
      .where(inArray(sprint.spaceId, accessibleSpaceIds))
      .orderBy(desc(sprint.createdAt)),
  ]);

  return {
    spaces,
    members: memberRows
      .filter((m) => m.userId)
      .map((m) => ({
        userId: m.userId as string,
        name: m.name,
        email: m.email,
        image: m.image ?? null,
      })),
    tags,
    sprints,
  };
}
