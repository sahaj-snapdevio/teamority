import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaceMember } from "@/db/schema";
import { pushToUser } from "@/lib/sse-clients";

/**
 * Low-level realtime fan-out. Do NOT call this directly from server actions —
 * always go through `refreshWorkspace()` in `lib/realtime/refresh.ts`, which
 * pairs the broadcast with the matching `revalidatePath` call. Keeping a single
 * caller makes the broadcast surface easy to reason about as the app grows.
 */

const PROTOCOL_VERSION = 1;

/** Active workspace members that have an account (invites without a userId are skipped). */
export async function getWorkspaceMemberUserIds(workspaceId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: workspaceMember.userId })
    .from(workspaceMember)
    .where(
      and(
        eq(workspaceMember.workspaceId, workspaceId),
        eq(workspaceMember.status, "ACTIVE"),
        isNotNull(workspaceMember.userId),
      ),
    );

  return rows.map((r) => r.userId).filter((id): id is string => id !== null);
}

/** Optional scope hints so subscribers can ignore changes that don't affect them. */
export interface DataChangedMeta {
  /** The task this change belongs to, when the mutation is task-scoped. */
  taskId?: string;
}

/**
 * Push a lightweight "data changed" signal to every member of a workspace so
 * their open views re-pull fresh data. Fire-and-forget: never throws, so a
 * broadcast failure can never break the mutation that triggered it.
 *
 * `meta.taskId` is optional. Subscribers treat a payload WITHOUT a taskId as
 * "this might affect me — refetch" (the safe default), and one WITH a taskId as
 * "only the view showing that task needs to refetch".
 */
export async function broadcastDataChanged(
  workspaceId: string,
  meta?: DataChangedMeta,
): Promise<void> {
  try {
    const userIds = await getWorkspaceMemberUserIds(workspaceId);
    const payload = {
      type: "data_changed" as const,
      workspaceId,
      v: PROTOCOL_VERSION,
      ...(meta?.taskId ? { taskId: meta.taskId } : {}),
    };
    for (const userId of userIds) {
      pushToUser(userId, payload);
    }
  } catch {
    // Realtime is best-effort — swallow so mutations are never affected.
  }
}
