import { and, inArray } from "drizzle-orm";
import { mutedEntity } from "@/db/schema";
import { db } from "@/lib/db";
import {
  type CreateNotificationParams,
  createNotifications,
} from "./create-notification";
import type { NotificationTriggerType } from "./types";

export interface BulkNotifyTaskInfo<T> {
  // Caller-defined per-task payload (title, etc.) handed back in buildMessage.
  data: T;
  // Defaults to taskId — the entity checked against `mutedEntity` for this task.
  muteCheckEntityId?: string;
  // This task's own recipient set for this trigger (e.g. its watchers).
  recipientIds: string[];
  taskId: string;
}

export interface CreateBulkNotificationsParams<T> {
  actorId: string | null;
  // Called once per unique recipient with only THEIR OWN subset of tasks
  // (already muted-filtered) — buildMessage decides the N=1 vs N>1 copy.
  buildMessage: (group: {
    recipientId: string;
    representativeTaskId: string;
    tasks: { taskId: string; data: T }[];
  }) => {
    body?: string;
    pushBody?: string;
    pushTitle?: string;
    pushUrl?: string;
    title: string;
  };
  entityType: CreateNotificationParams["entityType"];
  tasks: BulkNotifyTaskInfo<T>[];
  triggerType: NotificationTriggerType;
  workspaceId: string;
}

// Fire-and-forget, same contract as createNotifications. Collapses what would
// be one createNotifications() call per (recipient, task) — the naive result
// of looping a bulk action over its affected tasks — into one call per unique
// recipient covering every task THEY were notified about, so a recipient
// watching 3 of 5 bulk-changed tasks gets one notification, not 3.
export function createBulkNotifications<T>(
  params: CreateBulkNotificationsParams<T>
): void {
  void _createBulk(params).catch((err) => {
    console.error("[notifications] createBulkNotifications failed", err);
  });
}

async function _createBulk<T>(params: CreateBulkNotificationsParams<T>) {
  const { workspaceId, actorId, triggerType, entityType, tasks, buildMessage } =
    params;
  if (tasks.length === 0) {
    return;
  }

  const allRecipientIds = [...new Set(tasks.flatMap((t) => t.recipientIds))];
  const allMuteCheckIds = [
    ...new Set(tasks.map((t) => t.muteCheckEntityId ?? t.taskId)),
  ];

  // One batched mute query for the whole bulk operation (not per recipient),
  // mirroring create-notification.ts's own mute-check query shape.
  const mutedRows =
    allRecipientIds.length > 0 && allMuteCheckIds.length > 0
      ? await db
          .select({
            userId: mutedEntity.userId,
            entityId: mutedEntity.entityId,
          })
          .from(mutedEntity)
          .where(
            and(
              inArray(mutedEntity.userId, allRecipientIds),
              inArray(mutedEntity.entityId, allMuteCheckIds)
            )
          )
      : [];
  const mutedPairs = new Set(mutedRows.map((r) => `${r.userId}:${r.entityId}`));

  // Invert taskId -> recipientIds into recipientId -> their own tasks, dropping
  // only the individual (recipient, task) pairs the recipient has muted rather
  // than suppressing their whole aggregated notification.
  const groups = new Map<
    string,
    { data: T; muteCheckEntityId: string; taskId: string }[]
  >();
  for (const t of tasks) {
    const muteCheckEntityId = t.muteCheckEntityId ?? t.taskId;
    for (const recipientId of t.recipientIds) {
      if (mutedPairs.has(`${recipientId}:${muteCheckEntityId}`)) {
        continue;
      }
      const group = groups.get(recipientId) ?? [];
      group.push({ taskId: t.taskId, data: t.data, muteCheckEntityId });
      groups.set(recipientId, group);
    }
  }

  for (const [recipientId, group] of groups) {
    if (group.length === 0) {
      continue;
    }
    const representativeTaskId = group[0].taskId;
    const message = buildMessage({
      recipientId,
      representativeTaskId,
      tasks: group.map((g) => ({ taskId: g.taskId, data: g.data })),
    });

    // Deliberately omit muteCheckEntityIds here — the group above is already
    // muted-filtered per (recipient, task). Passing the full group's entity
    // ids would make createNotifications' own (all-or-nothing) mute check
    // suppress this entire notification if any one of them were muted,
    // undoing the per-task filtering just done. Its default fallback (the
    // representative entityId) is a redundant but harmless recheck of a task
    // we already know isn't muted for this recipient.
    createNotifications({
      workspaceId,
      actorId,
      recipientIds: [recipientId],
      triggerType,
      entityType,
      entityId: representativeTaskId,
      title: message.title,
      body: message.body,
      pushTitle: message.pushTitle,
      pushBody: message.pushBody,
      pushUrl: message.pushUrl,
    });
  }
}
