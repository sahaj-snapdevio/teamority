import { createId } from "@paralleldrive/cuid2";
import { addDays } from "date-fns";
import { db } from "@/lib/db";
import {
  notification,
  mutedEntity,
  userNotificationPreference,
  userEmailPreference,
  user,
} from "@/db/schema";
import { and, eq, inArray, or, isNull } from "drizzle-orm";
import type { NotificationTriggerType } from "./types";
import { emailDefaultFor } from "./types";
import { notificationSettingsUrl, notificationUrl } from "./links";
import { sendPushToUser } from "./push";
import { pushToUser } from "@/lib/sse-clients";
import { enqueueEmail } from "@/lib/email";
import { notificationTemplate } from "@/lib/email/templates/notification";
import { isSmtpConfigured } from "@/lib/smtp/client";

export interface CreateNotificationParams {
  workspaceId: string;
  actorId: string | null;
  recipientIds: string[];
  triggerType: NotificationTriggerType;
  entityType: "TASK" | "COMMENT" | "SPACE" | "WORKSPACE" | "SPRINT";
  entityId: string;
  title: string;
  body?: string;
  muteCheckEntityIds?: string[];
  // Push-specific overrides — separate from in-app title/body
  pushTitle?: string;
  pushBody?: string;
  pushUrl?: string;
}

// Fire-and-forget — never await this in a mutation handler
export function createNotifications(params: CreateNotificationParams): void {
  void _create(params).catch((err) => {
    console.error("[notifications] create failed", err);
  });
}

async function _create(params: CreateNotificationParams) {
  const {
    workspaceId,
    actorId,
    recipientIds,
    triggerType,
    entityType,
    entityId,
    title,
    body,
    muteCheckEntityIds,
    pushTitle,
    pushBody,
    pushUrl,
  } = params;

  // Remove actor from recipients (no self-notifications), deduplicate
  const eligibleIds = [...new Set(recipientIds.filter((id) => id !== actorId))];
  if (eligibleIds.length === 0) return;

  // Check muted entities — exclude users who muted this task/space
  const entitiesToCheck = muteCheckEntityIds ?? [entityId];
  const mutedRows = await db
    .select({ userId: mutedEntity.userId })
    .from(mutedEntity)
    .where(
      and(
        inArray(mutedEntity.userId, eligibleIds),
        inArray(mutedEntity.entityId, entitiesToCheck),
      ),
    );
  const mutedUserIds = new Set(mutedRows.map((r) => r.userId));
  const finalRecipients = eligibleIds.filter((id) => !mutedUserIds.has(id));
  if (finalRecipients.length === 0) return;

  // Fetch per-trigger preferences for all eligible recipients
  const prefs = await db
    .select({
      userId: userNotificationPreference.userId,
      inAppEnabled: userNotificationPreference.inAppEnabled,
      emailEnabled: userNotificationPreference.emailEnabled,
      pushEnabled: userNotificationPreference.pushEnabled,
    })
    .from(userNotificationPreference)
    .where(
      and(
        inArray(userNotificationPreference.userId, finalRecipients),
        eq(userNotificationPreference.triggerType, triggerType),
        or(
          isNull(userNotificationPreference.workspaceId),
          eq(userNotificationPreference.workspaceId, workspaceId),
        ),
      ),
    );

  // Build pref maps — default is enabled if no row exists
  const prefMap = new Map(prefs.map((p) => [p.userId, p]));

  const notifRecipients = finalRecipients.filter((id) => {
    const pref = prefMap.get(id);
    return pref ? pref.inAppEnabled : true; // default on
  });

  const pushRecipients = finalRecipients.filter((id) => {
    const pref = prefMap.get(id);
    return pref ? pref.pushEnabled : true; // default on
  });

  // Email defaults are NOT `true` like in-app/push — only high-signal triggers
  // opt in by default. See emailDefaultFor() in ./types.
  const emailRecipients = finalRecipients.filter((id) => {
    const pref = prefMap.get(id);
    return pref ? pref.emailEnabled : emailDefaultFor(triggerType);
  });

  const now = new Date();
  const expiresAt = addDays(now, 90);

  if (notifRecipients.length > 0) {
    await db.insert(notification).values(
      notifRecipients.map((recipientId) => ({
        id: createId(),
        workspaceId,
        recipientId,
        actorId,
        triggerType,
        entityType,
        entityId,
        title,
        body: body ?? null,
        isRead: false,
        createdAt: now,
        expiresAt,
      })),
    );
    // Push SSE event to all connected browsers for each recipient. Include the
    // title/body/url so the client can show an in-app toast popup, not just
    // refresh the badge.
    const toastUrl = pushUrl ?? `/${workspaceId}/notifications`;
    for (const recipientId of notifRecipients) {
      pushToUser(recipientId, {
        type: "new_notification",
        title,
        body: body ?? null,
        url: toastUrl,
        workspaceId,
      });
    }
  }

  // Send push notifications — fire-and-forget per recipient
  if (pushRecipients.length > 0) {
    await Promise.allSettled(
      pushRecipients.map((userId) =>
        sendPushToUser(userId, {
          title: pushTitle ?? title,
          body: pushBody ?? body ?? "",
          url: pushUrl ?? `/${workspaceId}/task/${entityId}`,
        }),
      ),
    );
  }

  // Instant email. Skipped entirely when SMTP isn't configured, so an
  // unconfigured self-host never accumulates undeliverable outbox rows.
  // `digest` recipients are picked up later by the digest worker straight from
  // the `notification` table; `off` recipients get nothing.
  if (emailRecipients.length > 0 && isSmtpConfigured()) {
    await sendInstantEmails({
      recipientIds: emailRecipients,
      workspaceId,
      entityType,
      entityId,
      title,
      body: body ?? null,
    });
  }
}

async function sendInstantEmails({
  recipientIds,
  workspaceId,
  entityType,
  entityId,
  title,
  body,
}: {
  recipientIds: string[];
  workspaceId: string;
  entityType: CreateNotificationParams["entityType"];
  entityId: string;
  title: string;
  body: string | null;
}) {
  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      deliveryMode: userEmailPreference.deliveryMode,
    })
    .from(user)
    .leftJoin(userEmailPreference, eq(userEmailPreference.userId, user.id))
    .where(inArray(user.id, recipientIds));

  // No preference row means the default delivery mode, "instant".
  const instant = rows.filter((r) => (r.deliveryMode ?? "instant") === "instant");
  if (instant.length === 0) {
    return;
  }

  const url = notificationUrl(workspaceId, entityType, entityId);
  const settingsUrl = notificationSettingsUrl(workspaceId);
  const { html, text } = await notificationTemplate({ title, body, url, settingsUrl });

  await Promise.allSettled(
    instant.map((r) =>
      enqueueEmail({ to: r.email, subject: title, html, text }),
    ),
  );
}
