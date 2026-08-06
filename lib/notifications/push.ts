import { eq } from "drizzle-orm";
import webpush from "web-push";
import { pushSubscription } from "@/db/schema";
import { db } from "@/lib/db";
import { getWebPushSettings } from "@/lib/integration-settings";

// Single source of truth for how long a push stays "fresh". The push service
// discards undelivered pushes after this window (via the TTL header) so a device
// that's been offline all day doesn't receive a full backlog on reconnect; the
// same value is sent in the payload (`ttlMs`) so the service worker applies the
// exact same cutoff when deciding whether to show the popup.
const PUSH_TTL_SECONDS = 600; // 10 minutes

// Resolved fresh (DB config, falling back to VAPID_* env vars) before every
// send rather than cached — a saved change in Settings → Integrations takes
// effect on the very next push, no restart needed (see docs/integrations.md).
// `setVapidDetails` validates the keys and THROWS on a malformed pair (e.g.
// the `your_public_key_here` placeholders straight out of .env.example) — push
// is optional, so an invalid/missing pair degrades to off rather than
// breaking the app (this module is imported by `create-notification.ts`,
// which every server action pulls in transitively).
async function ensureVapidDetails(): Promise<boolean> {
  const config = await getWebPushSettings();
  if (!config) {
    return false;
  }
  try {
    webpush.setVapidDetails(
      config.subject,
      config.publicKey,
      config.privateKey
    );
    return true;
  } catch (err) {
    console.warn(
      `[push] Web Push disabled — invalid VAPID key pair: ${
        err instanceof Error ? err.message : String(err)
      }. Generate a pair with \`npx web-push generate-vapid-keys\`.`
    );
    return false;
  }
}

export interface PushPayload {
  body: string;
  title: string;
  url?: string;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  if (!(await ensureVapidDetails())) {
    return;
  }

  const subs = await db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            ...payload,
            sentAt: Date.now(),
            ttlMs: PUSH_TTL_SECONDS * 1000,
          }),
          { TTL: PUSH_TTL_SECONDS }
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await db
            .delete(pushSubscription)
            .where(eq(pushSubscription.id, sub.id));
        }
      }
    })
  );
}
