import { env } from "@/lib/env";

type NotificationEntityType =
  | "TASK"
  | "COMMENT"
  | "SPACE"
  | "WORKSPACE"
  | "SPRINT";

/**
 * Absolute deep link for a notification, for use in email.
 *
 * Deliberately NOT derived from `CreateNotificationParams.pushUrl`: only one of
 * the ~24 `createNotifications()` call sites passes that, so it is `undefined`
 * almost everywhere. Tasks have a workspace-level route that needs no space or
 * list id; everything else falls back to the Inbox, which can resolve any entity.
 */
export function notificationUrl(
  workspaceId: string,
  entityType: NotificationEntityType,
  entityId: string
): string {
  if (entityType === "TASK") {
    return `${env.APP_URL}/${workspaceId}/task/${entityId}`;
  }
  return `${env.APP_URL}/${workspaceId}/notifications`;
}

/** Where the email footer sends people to change what they receive. */
export function notificationSettingsUrl(workspaceId: string): string {
  return `${env.APP_URL}/${workspaceId}/notifications/settings`;
}
