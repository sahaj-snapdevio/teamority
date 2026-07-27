# Web Push (VAPID) Setup

## Overview

**What it is:** browser/desktop push notifications — the kind that appear even when the Kanbanica tab isn't open. VAPID (Voluntary Application Server Identification) is a key pair that identifies your server to push services (Chrome/Firefox/Safari's push infrastructure) so they trust notifications as coming from you, without you needing an account with Google/Apple/Mozilla.

**Why Kanbanica uses it:** it's a self-contained standard (via the `web-push` npm package, `lib/notifications/push.ts`) — unlike SMTP or OAuth, there's no third-party account to create. You generate a key pair locally and use it.

**Required or optional:** fully **optional**. Nothing else in Kanbanica depends on it — in-app and email notifications work regardless.

---

## Step-by-step setup

### 1. Generate a key pair

From the project root:

```bash
npx web-push generate-vapid-keys
```

This prints a **Public Key** and a **Private Key** — no account, no dashboard, no external service. Generate this once per deployment (not once per environment variable change) and keep the pair together.

### 2. Set the environment variables

```bash
VAPID_PUBLIC_KEY=<the public key>
VAPID_PRIVATE_KEY=<the private key>
VAPID_SUBJECT=mailto:you@yourdomain.com
```

`VAPID_SUBJECT` must be a `mailto:` address or a `https://` URL — push services use it to contact you if your server is misbehaving (e.g. sending too much). Use a real, monitored address.

**Set the same three values on both the app and the worker.** Both processes send push notifications (`lib/notifications/push.ts` is imported by the notification-creation path, which runs from both server actions and the worker), so a mismatch between them means only some notifications arrive.

These are **runtime-only** — no build-time variable, no rebuild needed when you rotate keys. The browser fetches the current public key live from `/api/push/vapid-public-key` (`app/api/push/vapid-public-key/route.ts`), so this works identically on bare Node, PM2, Vercel, Railway/Render/Coolify, or Docker.

### 3. HTTPS is required

Browsers only allow push subscriptions on secure origins. `localhost` is exempted for local dev, but any real deployment needs HTTPS. If you're behind Cloudflare, set SSL mode to **Full (strict)** — anything less can break the service worker registration.

`/sw.js` (the service worker file) is served with `no-cache` specifically so browsers and CDNs never hold onto a stale version after a deploy.

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `VAPID_PUBLIC_KEY` | Only if you want push notifications | From `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Only if you want push notifications | Keep secret — this signs push payloads |
| `VAPID_SUBJECT` | Only if you want push notifications | `mailto:` address or `https://` URL |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional, legacy | Build-time fallback only, used if the runtime `/api/push/vapid-public-key` fetch fails. Not needed for a normal setup. |

---

## Verification

1. Restart the app (and worker) after setting the three `VAPID_*` variables.
2. Open Kanbanica over HTTPS (or `localhost`) and go to notification settings — enable push notifications when prompted. Your browser will ask for notification permission.
3. Trigger a notification (e.g. have another user assign you a task, or mention you in a comment).
4. A native OS notification should appear, even with the Kanbanica tab in the background or closed.
5. If nothing appears, check the server/worker logs for a line like `[push] Web Push disabled — invalid VAPID_* env values` (see below) — Kanbanica validates the keys lazily on first use and logs a warning rather than crashing if they're malformed.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `[push] Web Push disabled — invalid VAPID_* env values: ...` in logs | The keys are malformed — most commonly, someone left the literal placeholder values (`your_public_key_here` / `your_private_key_here`) from `.env.example` instead of running `npx web-push generate-vapid-keys`. Push silently degrades to "off" rather than crashing the app — regenerate the keys and restart. |
| Browser never prompts for notification permission | Confirm you're on HTTPS (or `localhost`) — browsers refuse push APIs on insecure origins entirely, with no error surfaced to the app. |
| Permission granted, but notifications never arrive | Check that `VAPID_*` matches on **both** the app and worker processes — the worker sends most notification pushes, and a stale/different key pair there fails silently per-recipient. |
| Notifications worked, then stopped for one user | Expected eventually — a push subscription can expire or be revoked by the browser. Kanbanica already handles this: a `410`/`404` response from the push service auto-deletes that subscription row (`lib/notifications/push.ts`) so it stops retrying. The user just needs to re-enable push in settings to get a fresh subscription. |
| Works locally, not in production behind Cloudflare | Set Cloudflare's SSL mode to **Full (strict)**, and confirm `/sw.js` isn't being cached by a CDN rule — it must be served `no-cache`. |

---

See also: [DEPLOYMENT.md → Optional](../../DEPLOYMENT.md#3-configure-env-for-production) for how this fits into a full production `.env`.
