import { revalidatePath, revalidateTag } from "next/cache";
import {
  broadcastDataChanged,
  type DataChangedMeta,
} from "@/lib/realtime/broadcast";
import { workspaceOverviewCacheTag } from "@/lib/realtime/cache-tags";

/**
 * The single "after a mutation" helper for the whole app.
 *
 * ARCHITECTURE RULE: every server mutation (server actions AND route handlers)
 * must call `refreshWorkspace(...)` after writing. New code must NEVER call
 * `broadcastDataChanged()` directly — routing everything through here keeps the
 * Next.js cache invalidation and the realtime broadcast in lockstep and gives us
 * exactly one place that fans out live updates.
 *
 * @param workspaceId  workspace whose members should be notified
 * @param paths        specific paths to revalidate. Defaults to the workspace
 *                     layout (`/${workspaceId}`, layout scope), which covers the
 *                     sidebar and every nested page. Pass concrete list/space
 *                     paths when a finer revalidation is wanted.
 * @param meta         optional scope hint. Pass `{ taskId }` for task-scoped
 *                     mutations so an open task detail view only refetches when
 *                     ITS task changed. Omitting it means "might affect anyone"
 *                     and every subscriber refetches (the safe default).
 */
export async function refreshWorkspace(
  workspaceId: string,
  paths?: string[],
  meta?: DataChangedMeta
): Promise<void> {
  if (paths && paths.length > 0) {
    for (const path of paths) {
      revalidatePath(path);
    }
  } else {
    revalidatePath(`/${workspaceId}`, "layout");
  }
  revalidateTag(workspaceOverviewCacheTag(workspaceId), "max");

  await broadcastDataChanged(workspaceId, meta);
}
