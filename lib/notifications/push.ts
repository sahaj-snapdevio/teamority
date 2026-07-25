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

// `setVapidDetails` validates the keys and THROWS on a malformed pair (e.g. the
// `your_public_key_here` placeholders straight out of .env.example). Doing that
// at module scope took the whole server down — this module is imported by
// `create-notification.ts`, which every server action pulls in transitively, so
// one bad env var turned into a boot-time crash on unrelated pages. Configure
// lazily instead and treat invalid keys the same as "not configured": push is
// optional, so it degrades to off rather than breaking the app.
let vapidReady: boolean | null = null;

function ensureVapidDetails(): boolean {
  if (!isConfigured()) return false;
  if (vapidReady === null) {
    try {
      webpush.setVapidDetails(
        env.VAPID_SUBJECT!,
        env.VAPID_PUBLIC_KEY!,
        env.VAPID_PRIVATE_KEY!,
      );
      vapidReady = true;
    } catch (err) {
      vapidReady = false;
      console.warn(
        `[push] Web Push disabled — invalid VAPID_* env values: ${
          err instanceof Error ? err.message : String(err)
        }. Generate a pair with \`npx web-push generate-vapid-keys\`.`,
      );
    }
  }
  return vapidReady;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureVapidDetails()) return;

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
