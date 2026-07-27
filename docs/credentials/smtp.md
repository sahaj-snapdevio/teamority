# SMTP (Email) Setup

## Overview

**What it is:** an outgoing-email connection Kanbanica uses to send magic-link sign-in emails, notification digests, invite emails, and password-reset links.

**Why Kanbanica uses it:** Kanbanica sends email over **standard SMTP via Nodemailer** (`lib/smtp/client.ts`, `lib/email/`) — no provider-specific code, so any SMTP provider works. Emails are queued to the `email_outbox` table and delivered by the background worker (`pnpm worker`), not sent inline from the request.

**Required or optional:** **optional in local development** (magic links are printed to the terminal instead), but you need **one of** SMTP / Google OAuth / `ALLOW_PASSWORD_SIGNUP=true` in production, or the app refuses to start.

---

## Step-by-step setup

### 1. Pick a provider

| Provider | Free tier | Notes |
|---|---|---|
| **Resend** (recommended) | ~3,000/mo (100/day) | Best developer experience; clear docs; requires a verified domain. |
| **Brevo** | ~300/day | Generous free tier; can start without owning a domain (uses a shared sending address until you verify one). |
| **SMTP2GO** | ~1,000/mo | Very simple SMTP setup, minimal DNS fuss. |
| **Postmark** | 100/mo then paid | Best transactional deliverability; strict about content quality. |
| **Amazon SES** | pay-as-you-go | Cheapest at scale; starts in a sandbox that only sends to verified addresses until you request production access. |

Any of these works — Kanbanica doesn't care which one you pick, since it's talking plain SMTP.

### 2. Create an account and get SMTP credentials

Using **Resend** as the walkthrough (the others follow the same shape):

1. Sign up at [resend.com](https://resend.com).
2. **Domains → Add Domain** — enter the domain you'll send from (e.g. `yourdomain.com`).
3. Resend shows you 2–4 DNS records to add (typically an **SPF** `TXT` record, one or more **DKIM** `CNAME`/`TXT` records, sometimes a `MX` record for that subdomain). Add these in your domain's DNS provider (Cloudflare, Namecheap, Route53, whichever you use).
4. Wait for Resend to show the domain as **Verified** (DNS propagation can take a few minutes to a few hours).
5. **API Keys → Create API Key** — this key IS your `SMTP_PASS`.
6. Resend's SMTP settings (shown in their dashboard) are:
   - Host: `smtp.resend.com`
   - Port: `587`
   - Username: `resend` (literally the word "resend")
   - Password: the API key from step 5

For other providers, look for an "SMTP" or "SMTP Relay" section in their dashboard — they'll give you the same four values (host/port/user/pass) in a similar format.

### 3. Set a DMARC policy (recommended, not required)

SPF and DKIM (from step 3) prove the email is authorized; **DMARC** tells receiving mail servers what to do if it isn't, and improves deliverability. Add a `TXT` record at `_dmarc.yourdomain.com`:

```
v=DMARC1; p=none; rua=mailto:you@yourdomain.com
```

`p=none` just monitors and reports — safe to start with. Tighten to `p=quarantine` or `p=reject` later once you've confirmed legitimate mail passes.

### 4. Set the environment variables

```bash
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=<your-api-key>
EMAIL_FROM="Kanbanica <noreply@yourdomain.com>"
```

`EMAIL_FROM` **must** be an address on the domain you just verified — sending "from" an unverified domain gets the message rejected or spam-filtered, regardless of how correct your SMTP credentials are.

Restart the app after editing `.env`.

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `SMTP_HOST` | For production email | e.g. `smtp.resend.com` |
| `SMTP_PORT` | For production email | `587` (STARTTLS) for most providers; some require `465` (implicit TLS) |
| `SMTP_USER` | For production email | Provider-specific — sometimes literally a fixed string like `resend` or `apikey`, sometimes your account email |
| `SMTP_PASS` | For production email | An API key or SMTP-specific password — **not** your account login password for most providers |
| `EMAIL_FROM` | For production email | Must be on a domain with verified SPF/DKIM |
| `EMAIL_WEBHOOK_SECRET` | Optional | Only if you want delivery-event tracking — see below |

---

## Verification

1. Restart the app after setting `SMTP_*`.
2. Trigger any email — easiest is signing out and requesting a magic link at `/login`, or triggering a notification.
3. Check the recipient inbox (and spam folder — first sends from a new domain sometimes land there until reputation builds).
4. If nothing arrives, check the worker logs (`pnpm worker`, or `docker compose logs worker` in production) — send failures are logged there, and the `email_outbox` table (`db/schema/email-outbox.ts`) records `status: failed` rows with `last_error` populated for exactly this reason.
5. In production only: `docs/authentication.md` notes that configuring SMTP also **switches on email verification** for password sign-ups — a good end-to-end check is registering a test account at `/signup` and confirming the verification email arrives and its link works.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Emails never arrive, no error visible | Check `docker compose logs worker` (or your worker process's logs) — emails are queued and sent by the worker, not the web request. A stopped/crashed worker means nothing ever sends. |
| Emails rejected or land in spam | Missing/incorrect SPF or DKIM records, or `EMAIL_FROM` isn't on the verified domain. Re-check your provider's DNS instructions — a single missing `TXT` record is the most common cause. |
| `Invalid login` / `535` auth error | Wrong `SMTP_USER`/`SMTP_PASS` — most providers use an API key as the password, not your dashboard login password. Double check you copied the SMTP-specific credential, not a general API key for a different purpose. |
| Works with one provider's test tool but not from Kanbanica | Check `SMTP_PORT` — using `465` with STARTTLS-only settings (or vice versa) fails silently for some providers. Try `587` first. |
| Amazon SES: emails silently don't send to real inboxes | SES starts in a **sandbox** that only delivers to addresses you've manually verified. Request production access in the SES console before going live. |
| Local dev: "I never get the magic link" | Expected — SMTP isn't required locally. The link is printed in the `pnpm dev` terminal output instead. See [SETUP.md](../../SETUP.md). |

---

## Optional: delivery-event webhook

Set `EMAIL_WEBHOOK_SECRET` and point your provider's webhook (delivery/bounce/complaint events) at `POST /api/webhooks/email` (`app/api/webhooks/email/route.ts`) to record delivery events into the `email_events` table. The endpoint accepts either an `Authorization: Bearer <secret>` header or an `x-webhook-secret` header — check which one your provider supports and configure accordingly. This is purely observational (nothing in the app currently acts on bounce/complaint events) — safe to skip if you don't need delivery visibility.
