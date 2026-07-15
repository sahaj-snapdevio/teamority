import webpush from "web-push";
import { db } from "@/lib/db";
import { pushSubscription } from "@/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";

// Single source of truth for how long a push stays "fresh". The push service
// discards undelivered pushes after this window (via the TTL header) so a device
// that's been offline all day doesn't receive a full backlog on reconnect; the
// same value is sent in the payload (`ttlMs`) so the service worker applies the
// exact same cutoff when deciding whether to show the popup.
const PUSH_TTL_SECONDS = 600; // 10 minutes

function isConfigured() {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

if (isConfigured()) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT!,
    env.VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!isConfigured()) return;

  const subs = await db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            ...payload,
            sentAt: Date.now(),
            ttlMs: PUSH_TTL_SECONDS * 1000,
          }),
          { TTL: PUSH_TTL_SECONDS },
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await db.delete(pushSubscription).where(eq(pushSubscription.id, sub.id));
        }
      }
    }),
  );
}
