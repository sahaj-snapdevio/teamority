# Deploying Kanbanica (Self-Hosting for Teams)

This guide runs Kanbanica in **production on your own server** so your team can use it. It's the production counterpart to [SETUP.md](./SETUP.md) (which covers local development).

> **Two ways to run Kanbanica:**
> - **Local development** — contributors use `pnpm db:local` + `pnpm dev` (see [SETUP.md](./SETUP.md)). Unchanged.
> - **Self-hosting** — teams use **Docker Compose** (this guide). This is an *additional* option, not a replacement.

The stack runs as three long-lived services plus a one-shot migration step:

| Service | What it does |
|---------|--------------|
| **postgres** | The database (with a persistent volume). |
| **migrate** | Applies pending DB migrations, then exits. Runs automatically on `up`. |
| **app** | The Next.js web server on port 3000. |
| **worker** | Background jobs: email, notification digests, due-date reminders, sprint auto-close. **Run exactly one.** |

---

## 1. Prerequisites

- A Linux server with **Docker** and the **Docker Compose plugin** (`docker compose version`).
- A **domain** pointed at the server (e.g. `tasks.yourcompany.com`).
- **An authentication provider** (see step 3) — SMTP, Google OAuth, or `ALLOW_PASSWORD_SIGNUP=true`. **One is required in production**; without any, users can't log in and the app refuses to start.

---

## 2. Get the code and create `.env`

```bash
git clone https://github.com/sahaj-snapdevio/Kanbanica.git kanbanica
cd kanbanica
cp .env.example .env
```

---

## 3. Configure `.env` for production

Edit `.env` and set the following.

### Required

```bash
# Point at the bundled Postgres service (note host = "postgres", port 5432):
DATABASE_URL=postgresql://kanbanica:CHANGE_ME@postgres:5432/kanbanica

# A strong secret (generate one):  openssl rand -hex 32
APP_SECRET=<32+ random characters>

# Your real public URL (HTTPS). Read at runtime — no rebuild if it changes.
APP_URL=https://tasks.yourcompany.com

# Postgres provisioning (must match DATABASE_URL above):
POSTGRES_USER=kanbanica
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=kanbanica
```

> Bringing your own database instead? See [Using an external PostgreSQL](#using-an-external-postgresql) — you set `DATABASE_URL` and skip the three `POSTGRES_*` variables entirely.

### At least one authentication provider (required in production)

**Option A — SMTP** (enables magic-link login). See
[Production email (SMTP)](#production-email-smtp) below for provider choices and
DNS. Minimal shape:

```bash
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587                      # 587 (STARTTLS) for most providers; some use 465
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=noreply@yourdomain.com  # must be on a domain you've verified (SPF/DKIM)
```

**Option B — Google OAuth** (login without email):

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

**Option C — Email + password** (no external service at all): set `ALLOW_PASSWORD_SIGNUP=true`.

> If you configure **none of the three**, the app will exit on startup with a clear error — by design, so you never ship a silently broken login.

### Optional

- **File storage** — defaults to `STORAGE_DRIVER=local` (persisted in the `uploads` Docker volume). For object storage set `STORAGE_DRIVER=s3` (or `r2`) and the `S3_*` variables.
- **Web Push (browser/desktop notifications)** — set the runtime `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (`npx web-push generate-vapid-keys`) on the **app and worker**. That's all — the client fetches the public key at runtime from `/api/push/vapid-public-key`, so it works on **any** deployment (bare `pnpm build && pnpm start`, PM2, Vercel/Railway/Render/Coolify, Docker) with **no build-time key and no rebuild when keys rotate**. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is optional/legacy (a build-time fallback). Requires HTTPS (behind Cloudflare, use SSL mode **Full (strict)**); `/sw.js` is served `no-cache` so CDNs/browsers never keep a stale service worker.

### Environment variable reference

Complete list of variables (validated by `lib/env.ts`). "Client" means it's inlined into the browser bundle at build time (`NEXT_PUBLIC_*`).

| Variable | Required? | Default | Purpose |
|----------|-----------|---------|---------|
| `DATABASE_URL` | ✅ always | — | PostgreSQL connection string (Docker: host `postgres`, port `5432`). |
| `APP_SECRET` | ✅ always | — | Better Auth signing secret; 32+ chars (`openssl rand -hex 32`). |
| `APP_URL` | ✅ always | — | Public URL; used for auth, invite links, email content, file URLs. **Runtime** — change it and restart, no rebuild. (`NEXT_PUBLIC_APP_URL` is the deprecated old name and still works.) |
| `NODE_ENV` | — | `development` | Set to `production` in prod (compose/images already do). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | ⚠️ prod: one login method | `SMTP_PORT=587` | Magic-link + notification email. Unset in dev → emails logged to console. **Also switches signup email-verification on** — see [Authentication](#authentication). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ⚠️ prod: one login method | — | Optional Google OAuth login. |
| `ALLOW_PASSWORD_SIGNUP` | ⚠️ prod: one login method | `false` | Allow visitors to register at `/signup` with email + password. Off = invite-only. |
| `EMAIL_WEBHOOK_SECRET` | optional | — | Auth for the SMTP provider delivery webhook. |
| `STORAGE_DRIVER` | optional | `local` | `local` (./uploads volume) or `s3` / `r2`. |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | needed if `STORAGE_DRIVER=s3\|r2` | MinIO-style defaults | Object-storage credentials. `S3_ENDPOINT` for R2/MinIO; omit for AWS S3. |
| `S3_PUBLIC_URL` | optional | — | CDN/public origin for serving stored files. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | optional | — | Web Push (`npx web-push generate-vapid-keys`). |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | optional | `support@kanbanica.com` | Override the support email shown in the UI. **Client.** |
| `NEXT_PUBLIC_MARKETING_DOMAIN` | optional | `kanbanica.com` | Override the marketing domain shown in the UI. **Client.** |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Docker only | `kanbanica` | Provision the bundled Postgres; must match `DATABASE_URL`. |
| `APP_PORT` | Docker only | `3000` | Host port mapped to the app container. |

### Using an external PostgreSQL

By default the stack runs a bundled `postgres` container. If you already have a
database — a company cluster, or a managed one — point `DATABASE_URL` at it and
add the overlay file, which skips the bundled container:

```bash
# Bundled Postgres (default, unchanged)
docker compose up -d

# Your own Postgres
docker compose -f docker-compose.yml -f docker-compose.external-db.yml up -d
```

The overlay only *subtracts*: it stops the `postgres` service from being created
and removes the "wait for postgres" dependency. Everything else — the app, the
worker, and the one-shot `migrate` job — is unchanged, so **migrations still run
automatically before the app starts**. `scripts/migrate.ts` waits for the
database itself (retrying with backoff up to ~2 min) instead of relying on a
container healthcheck, and takes a `pg_advisory_lock` so two concurrent deploys
can't apply the same migration twice.

Requires **Docker Compose ≥ 2.20** (for `depends_on.<service>.required`). Check
with `docker compose version`.

There is nothing provider-specific in Kanbanica: **any PostgreSQL 16+ reachable
over the network works.** Some example `DATABASE_URL`s:

```bash
# Self-managed / company cluster
DATABASE_URL=postgresql://kanbanica:pass@db.internal:5432/kanbanica

# Managed providers generally require TLS
DATABASE_URL=postgresql://user:pass@ep-xyz.neon.tech/kanbanica?sslmode=require
DATABASE_URL=postgresql://user:pass@xyz.rds.amazonaws.com:5432/kanbanica?sslmode=require

# Behind a transaction-mode pooler (pgbouncer)
DATABASE_URL=postgresql://user:pass@pooler.example.com:6543/kanbanica?sslmode=require&pgbouncer=true
```

**TLS.** `?sslmode=require` encrypts the connection without verifying the
server's certificate. Use `?sslmode=verify-full` to also verify it against the
system CA store — note this fails for providers that use a private CA (such as
AWS RDS's own root) unless that CA is installed in the image.

**Poolers.** Append `?pgbouncer=true` when connecting through a transaction-mode
pooler. Kanbanica then disables prepared statements, which pgbouncer cannot
support in that mode.

**A database on the Docker host** is not reachable as `localhost` from inside a
container. Use `host.docker.internal` and uncomment the `extra_hosts` block at
the bottom of `docker-compose.external-db.yml`.

**Connections.** The app, worker and migrate containers each open their own pool
(the app allows up to 20 connections). On small managed tiers with low
connection caps, keep that in mind when sizing.

**Copy-pasted URLs are normalised for you.** Connection strings from managed
providers often carry client-only parameters (`channel_binding`, `pgbouncer`,
`sslmode`, …). Kanbanica uses two different PostgreSQL drivers internally, and
they disagree about those parameters, so `lib/pg-connection.ts` strips them and
resolves TLS once for both. You can paste a provider's URL as-is.

### Authentication

Kanbanica ships three login methods. They all create the same session and the same
`user` row — one account per email address, no matter how someone signs in.

| Method | What it needs | Enabled when |
|--------|---------------|--------------|
| **Magic link** | SMTP (in production) | always on |
| **Google OAuth** | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | both are set |
| **Email + password** | nothing | sign-**in** always; sign-**up** needs `ALLOW_PASSWORD_SIGNUP=true` |

> **Production auth rule:** if `NODE_ENV=production` and **none** of SMTP, Google OAuth,
> or `ALLOW_PASSWORD_SIGNUP=true` is configured, the app refuses to start — otherwise
> nobody could obtain an account. Each screen only renders the methods you configured,
> so a deployment without Google never shows a Google button.

#### Signup behaviour depends on SMTP

This surprises people, so it's worth stating plainly. **Configuring SMTP turns on email
verification for password signups.**

| SMTP | What happens at `/signup` |
|------|---------------------------|
| **not configured** | Account is created and the user is signed in **immediately**. No verification email (there'd be no way to deliver it). |
| **configured** | A verification email is sent. The user **cannot sign in** until they click the link. |

Two consequences of the SMTP-configured path worth knowing:

- Only a **verified** account can later link Google to the same email. Better Auth refuses
  to attach an OAuth account to an unverified user, so an unverified password account that
  clicks "Continue with Google" gets an *account not linked* error. Verification is what
  flips that bit.
- Duplicate signups return a generic response instead of "user already exists", so the
  signup form doesn't leak which emails are registered.

Password rules: **8–128 characters**, enforced server-side. `/forgot-password` only exists
when SMTP is configured — without a mail path the reset link could never be delivered.

Full reference: [`docs/authentication.md`](./docs/authentication.md).

### Production email (SMTP)

Kanbanica sends magic-link and notification emails over **standard SMTP via
Nodemailer**, so it works with **any SMTP provider** — you bring the credentials.
Swapping providers is an **environment-variable change only**; no code changes.

Pick whichever fits your deployment:

| Provider | Free tier | Notes |
|----------|-----------|-------|
| **Resend** (recommended) | ~3,000/mo (100/day) | Best developer experience; great docs. Requires a verified domain. |
| **Brevo** | ~300/day | Generous free tier; can start without owning a domain. |
| **SMTP2GO** | ~1,000/mo | Very simple SMTP setup. |
| **Postmark** | 100/mo then paid | Best transactional deliverability. |
| **Amazon SES** | pay-as-you-go | Cheapest at scale; more setup (sandbox → production request). |

Typical settings (check your provider's dashboard for exact values):

```bash
# Example — Resend
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=<your-api-key>
EMAIL_FROM="Kanbanica <noreply@yourdomain.com>"
```

**DNS / deliverability (required):** in your provider's dashboard, add and verify
your sending domain, then create the DNS records it gives you — **SPF** and
**DKIM** at minimum, plus a **DMARC** policy. `EMAIL_FROM` must be an address on
that verified domain, or mail is rejected or spam-filtered. Use port **587
(STARTTLS)** unless the provider specifies **465** (implicit TLS).

**Multiple deployments:** each instance (your hosted demo, and every self-hosted
install) sets its **own** `SMTP_*`/`EMAIL_FROM` in its own environment. Secrets
are never committed — the repo ships only an empty `.env.example`.

Local development needs **no SMTP**: magic links print to the terminal (see
[SETUP.md](./SETUP.md)).

---

## 4. Bring it up

```bash
docker compose up -d --build
```

This builds the images, starts Postgres, runs migrations (the `migrate` service), then starts `app` and `worker`.

Check status and health:

```bash
docker compose ps
curl -f http://localhost:3000/api/health     # → {"ok":true,"db":"connected"}
```

---

## 5. Create your first admin

**Self-hosted (recommended):** set `AUTO_PROMOTE_FIRST_ADMIN=true` in your environment before first launch. The **first** user to sign in then automatically becomes the platform (Orbit) admin — no terminal step. This only fires on a brand-new install (empty user table).

**Otherwise (or for hosted SaaS):** leave `AUTO_PROMOTE_FIRST_ADMIN` unset/`false`, sign in through the UI once to create your user, then promote it:

```bash
docker compose exec worker node_modules/.bin/tsx scripts/make-admin.ts you@yourcompany.com
```

> The worker image has no `pnpm` at runtime (see `Dockerfile.worker`), so call `tsx` directly rather than `pnpm make:admin`. The `app` container can't run it either — it's a standalone build with no `scripts/`.

Two scripts exist, for different situations:

| Script | Use when |
|---|---|
| `scripts/make-admin.ts <email>` | The user **already signed in** — promotes that existing account. |
| `scripts/create-admin.ts <email> <password> [name]` | No account exists — creates one with a password that can sign in at `/admin/login`. |

Either is the recovery path if an instance ever ends up with zero admins.

---

## 6. HTTPS / reverse proxy

Run a reverse proxy in front of the app on port 3000 to terminate TLS on your domain.

**Caddy** (automatic HTTPS) — `Caddyfile`:

```
tasks.yourcompany.com {
    reverse_proxy localhost:3000
}
```

**Nginx** — key points:

```nginx
server {
    server_name tasks.yourcompany.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
    # Real-time (SSE): do not buffer this endpoint, or live updates lag/stall.
    location /api/me/notifications/stream {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
    }
}
```

Make sure `APP_URL` matches the public HTTPS URL. Auth uses it for secure cookies and callback/magic-link URLs.

---

## 7. Backups

- **Database:**
  ```bash
  docker compose exec postgres pg_dump -U kanbanica kanbanica > backup-$(date +%F).sql
  ```
- **Uploads** (only if `STORAGE_DRIVER=local`): back up the `uploads` Docker volume. With S3/R2, your provider handles durability.

---

## 8. Updating

```bash
git pull
docker compose up -d --build
```

The `migrate` service applies any new migrations automatically before the app starts.

---

## 9. Operational notes & limits

- **Run exactly one worker.** Do **not** `docker compose up --scale worker=N`. Jobs are durable in Postgres, but multiple workers can double-process.
- **Single app instance (for now).** Real-time updates and in-app notifications use an in-memory registry per process. Running **2+ app instances** behind a load balancer would drop cross-instance events — that needs a shared Redis pub/sub, which isn't implemented yet. One app instance is fine for typical team use.
- **Database connections.** The pool is `max: 20` (`lib/db.ts`). Tune for your Postgres if needed.
- **Changing the domain** is a restart, not a rebuild: edit `APP_URL` in `.env`, then `docker compose up -d`. Nothing deployment-specific is baked into the image.

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| App exits on start: "No authentication provider configured" | Set **one** of: SMTP, Google OAuth, or `ALLOW_PASSWORD_SIGNUP=true` in `.env` (step 3). |
| `unrecognized configuration parameter "channel_binding"` (or `"pgbouncer"`) | You're on a build predating connection-string normalisation. Pull latest; Kanbanica now strips client-only URL params. |
| `self-signed certificate in certificate chain` connecting to a managed DB | Your provider uses a private CA. Use `?sslmode=require` rather than `?sslmode=verify-full`, or install the provider's CA in the image. |
| `migrate` exits 1: database unreachable after 10 attempts | The external DB isn't reachable from the container. Check firewall/VPC rules, and use `host.docker.internal` (not `localhost`) if it runs on the Docker host. |
| Using an external DB but a `postgres` container still starts | You forgot `-f docker-compose.external-db.yml`. Both `-f` flags are required, in that order. |
| `depends_on` error mentioning `required` | Docker Compose is older than 2.20. Upgrade, or run `docker compose up -d app worker`. |
| Users never receive the magic-link email | SMTP misconfigured or DNS (SPF/DKIM) failing. Check `docker compose logs worker`. |
| New password signups can't log in ("Email not verified") | Expected once SMTP is set — they must click the verification link. See [Authentication](#authentication). |
| Password user gets "account not linked" on Google sign-in | Their email isn't verified yet. Verification is what allows linking Google to an existing account. |
| `/signup` returns 404 | `ALLOW_PASSWORD_SIGNUP` is not `true`. The instance is invite-only by design. |
| `/api/health` returns 503 | App can't reach Postgres — check `DATABASE_URL` host is `postgres` and the DB is healthy (`docker compose ps`). |
| Real-time updates lag or don't appear | Reverse proxy is buffering `/api/me/notifications/stream` (see step 6), or you're running multiple app instances (step 9). |
| Uploaded files disappear after redeploy | Local storage without a persistent volume. The compose file mounts `uploads`; or switch to S3/R2. |
| Migrations didn't run | Check `docker compose logs migrate` — it must exit 0 before app/worker start. |

---

Questions or issues? Open a GitHub issue. Happy self-hosting. 🚀
