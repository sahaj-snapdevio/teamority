# Credential Setup Guides

Step-by-step guides for every optional third-party service Kanbanica can integrate with. None of these are required to run Kanbanica locally — see [SETUP.md](../../SETUP.md) for the zero-config local dev path. In production you need **at least one** login method (SMTP, Google OAuth, or `ALLOW_PASSWORD_SIGNUP=true`); everything else here stays fully optional.

| Guide | For | Required? |
|---|---|---|
| [Google OAuth](./google-oauth.md) | "Sign in with Google" | One of three login methods — see [authentication.md](../authentication.md) |
| [SMTP (Email)](./smtp.md) | Magic-link sign-in, notifications, invites | One of three login methods; also needed for email notifications generally |
| [Web Push (VAPID)](./web-push-vapid.md) | Browser/desktop push notifications | Fully optional — no third-party account needed, just a generated key pair |
| [Amazon S3](./storage-s3.md) | Cloud file storage for attachments/avatars | Optional — local disk storage works for a single persistent host |
| [Cloudflare R2](./cloudflare-r2.md) | Cloud file storage (S3-compatible, no egress fees) | Optional — alternative to S3, same code path |

## What's not covered here

- **PostgreSQL** — the database connection isn't a third-party "credential" in the same sense; local dev needs zero setup (bundled), and connecting to your own/managed Postgres is documented in [DEPLOYMENT.md → Using an external PostgreSQL](../../DEPLOYMENT.md#using-an-external-postgresql).
- **`APP_SECRET`** — a single locally-generated random value (`openssl rand -hex 32`), not a third-party credential. See [DEPLOYMENT.md § 3](../../DEPLOYMENT.md#3-configure-env-for-production).
- **GitHub OAuth** — not currently supported by Kanbanica. Only Google OAuth, magic-link email, and email+password are implemented (`lib/auth.ts`).
- **Redis** — not currently used by Kanbanica at all. Real-time sync and notifications run on an in-memory registry per process; a Redis-backed multi-instance mode is a [roadmap idea](../../ROADMAP.md), not something to configure today.

If the codebase adds support for any of the above, add a guide here rather than leaving it undocumented — see the pattern used by the existing guides (Overview → Step-by-step setup → Environment variables → Verification → Troubleshooting).
