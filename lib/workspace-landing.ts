import { and, asc, eq, inArray } from "drizzle-orm";
import { list, space } from "@/db/schema";
import { db } from "@/lib/db";
import {
  getAccessibleSpaceIds,
  getWorkspaceMembership,
} from "@/lib/permissions";

/**
 * Where a user should land when they open a workspace. Single source of truth
 * shared by the workspace home page and /post-auth so the routing can't drift.
 *
 * Distinguishes "no projects at all" (→ onboarding / create the first project)
 * from "only archived projects" (→ stay in the workspace and offer Restore), so
 * archiving the last project never locks anyone out of their workspace.
 */
export type WorkspaceLandingState =
  | { kind: "ACTIVE_SPACE"; spaceId: string; listId: string | null }
  | {
      kind: "ONLY_ARCHIVED";
      archived: { id: string; name: string; color: string | null; logoEmoji: string | null }[];
    }
  | { kind: "EMPTY" }
  | { kind: "NO_ACCESS" };

export async function getWorkspaceLandingState(
  userId: string,
  workspaceId: string
): Promise<WorkspaceLandingState> {
  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership) {
    return { kind: "NO_ACCESS" };
  }

  const activeSpaceIds = await getAccessibleSpaceIds(userId, workspaceId);
  if (activeSpaceIds.length > 0) {
    const [firstList] = await db
      .select({ id: list.id, spaceId: list.spaceId })
      .from(list)
      .where(
        and(inArray(list.spaceId, activeSpaceIds), eq(list.isArchived, false))
      )
      .orderBy(asc(list.createdAt))
      .limit(1);

    if (firstList) {
      return {
        kind: "ACTIVE_SPACE",
        spaceId: firstList.spaceId,
        listId: firstList.id,
      };
    }
    // An accessible active project exists but has no list yet — open the project
    // itself (it renders its own empty state) rather than falling to onboarding.
    return { kind: "ACTIVE_SPACE", spaceId: activeSpaceIds[0], listId: null };
  }

  // No active projects. Guests can't create or restore, so there's nothing for
  // them here.
  if (membership.role === "GUEST") {
    return { kind: "NO_ACCESS" };
  }

  const archivedSpaceIds = await getAccessibleSpaceIds(
    userId,
    workspaceId,
    true
  );
  if (archivedSpaceIds.length > 0) {
    const archived = await db
      .select({ id: space.id, name: space.name, color: space.color, logoEmoji: space.logoEmoji })
      .from(space)
      .where(inArray(space.id, archivedSpaceIds))
      .orderBy(asc(space.orderIndex), asc(space.createdAt));
    return { kind: "ONLY_ARCHIVED", archived };
  }

  // Truly empty workspace — no projects at all.
  return { kind: "EMPTY" };
}
