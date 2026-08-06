# Integrations

Instance-level service configuration (SMTP, Google OAuth, S3/R2 storage, Web
Push) can be set up from inside Kanbanica instead of hand-editing `.env` —
either during first-run setup (`/setup`'s "Configure services" step) or any
time after from **Settings → Integrations** (`/orbit/integrations`,
platform-admin only, `requireAdmin()`). Both surfaces render the *same* form
components (`components/orbit/integrations/`) and call the *same* server
action — there is exactly one implementation of the settings UI and its
validation.

Minimum required `.env` going forward: `DATABASE_URL`, `APP_URL`, `APP_SECRET`.
Everything else is optional — configure it in `.env`, in-app, both (in-app
wins per field), or neither (falls back gracefully).

---

## Structure

A single-row table, one column per field, one file per concern — no generic
provider registry:

- **`db/schema/integration-settings.ts`** — the `integration_settings` table.
  One row (`id = "default"`). One text/integer column per field (`smtpHost`,
  `smtpPort`, `googleClientId`, `storageDriver`, `vapidPublicKey`, …), and a
  `*Encrypted` column alongside each secret field (`smtpPassEncrypted`,
  `googleClientSecretEncrypted`, `storageSecretAccessKeyEncrypted`,
  `vapidPrivateKeyEncrypted`).
- **`lib/crypto.ts`** — generic `encryptSecret()` / `decryptSecret()`
  (AES-256-GCM, key derived from `APP_SECRET` via SHA-256 — no second
  required env var). Not integration-specific; reusable for any future secret
  needing encryption at rest.
- **`lib/integration-settings.ts`** — the resolution layer. One `getRow()`
  (the single DB row, memoized per request with React's `cache()`) and one
  getter per concern:
  - `getSmtpSettings()` / `isSmtpConfigured()`
  - `getGoogleOAuthSettings()` / `isGoogleOAuthConfigured()`
  - `getStorageSettings()`
  - `getWebPushSettings()`
  - `getIntegrationSettingsSummary()` — the DB-only (no env fallback) DTO
    that prefills the Settings page's forms; secrets are represented as
    `has<Field>: boolean` only, never sent to the client in plaintext.

  Each getter resolves **per field**: the DB column wins if non-empty, else
  the matching `.env` var. This is more granular than "whole provider from DB
  vs. whole provider from env" — an admin can, for example, save just a new
  SMTP password while the host/user/from still come from `.env`.
- **`components/orbit/integrations/`** — `IntegrationCard` (shared card shell:
  title, "Configured"/"Not configured" badge, Save/Remove buttons, optional
  restart note) plus one form component per concern (`smtp-settings-form.tsx`,
  `google-oauth-settings-form.tsx`, `storage-settings-form.tsx`,
  `web-push-settings-form.tsx`). Secret fields reuse the existing
  `components/common/password-input.tsx` primitive with a
  `"Saved — leave blank to keep"` placeholder.
- **`app/actions/integrations.ts`** — `saveIntegrationSettingsAction()`, a
  single `requireAdmin()`-gated server action taking a partial,
  section-keyed body (`{ smtp?: {...}, google?: {...}, storage?: {...},
  webPush?: {...} }`). Within a section: a field omitted is left untouched, an
  empty string clears it, a non-empty value sets it (encrypted for secret
  fields). One upsert into the single row per call.
- **`app/(orbit)/orbit/integrations/page.tsx`** — server component, calls
  `getIntegrationSettingsSummary()` and renders the four forms directly (no
  registry/loop — just four explicit `<XSettingsForm initial={...} />` calls).
  The setup wizard's "Configure services" step imports and renders the exact
  same four components, passing an empty settings shape (nothing has been
  saved yet at that point in a first-run install).

There is no `enabled` flag — a section counts as **configured** simply by
having its required fields present (e.g. `!!(host && user && from &&
hasPassword)` for SMTP). "Remove" clears the fields back to empty, which then
falls through to `.env` or "unconfigured". There is also no generic
"provider" abstraction, no connection-test framework, and no status-tracking
columns (`lastTestedAt`, etc.) — each concern is a small, explicit,
independently-readable file.

## Resolution order

Every getter resolves the same way, per field: **DB column (if non-empty) →
`.env` var → unconfigured.** For an existing `.env`-only deployment (the
`integration_settings` row has never been written), every getter's DB half is
always empty and the result is identical to `.env`-only behavior — zero
change for existing installs.

## Restart semantics

Google OAuth is consumed by `lib/auth.ts`'s module-level `betterAuth({...})`
singleton via a **top-level `await getGoogleOAuthSettings()`** — resolved
once, the first time the module is imported in a process, then baked in for
that process's lifetime. A saved change only takes effect after a restart.
This is deliberately the *only* restart-required integration:

| Concern | Restart required? | Why |
|---|---|---|
| Google OAuth | **Yes** | `socialProviders.google` is fixed at `lib/auth.ts`'s module-eval time (top-level await) — Better Auth builds this once, synchronously. |
| SMTP | No | `sendEmailViaSmtp()` calls `getSmtpSettings()` fresh on every send. |
| Storage | No | `lib/storage.ts` resolves `getStorageSettings()` on every call and caches the built `files-sdk` client by a signature of the resolved config — a settings change transparently rebuilds it on next use. |
| Web Push | No | `lib/notifications/push.ts` calls `getWebPushSettings()` fresh before every send; `/api/push/vapid-public-key` resolves the same way per request. |

`lib/auth.ts`'s top-level await is wrapped in a try/catch: `next build`'s
page-data-collection phase imports this module against a placeholder
`DATABASE_URL` with no real Postgres to query, and at real runtime a DB
hiccup on the very first request that imports the module shouldn't take the
whole server down — either way it falls back to "Google not configured,"
the same failure mode as the env vars simply being unset.

## Encryption

`lib/crypto.ts`'s `encryptSecret()`/`decryptSecret()` — AES-256-GCM, key
derived from `APP_SECRET` via SHA-256 (not a second dedicated env var, since
`APP_SECRET` is already required and already a high-trust server secret —
it's Better Auth's `secret`). Format: `iv:authTag:ciphertext`, each
hex-encoded and colon-joined.

**Trade-off:** rotating `APP_SECRET` (e.g. after a leak) invalidates every
session *and* makes every encrypted field permanently undecryptable — after
rotating it, re-enter SMTP/Google/storage/Web Push credentials.

Secrets are never sent to the client after the initial save — every read
path exposes only a `has<Field>: boolean`. The only way to change a secret is
to type a new value; there's no "reveal" affordance anywhere.

## What's covered

Only real, already-implemented integrations: SMTP, Google OAuth, S3/R2
storage, Web Push. Not included (no existing implementation to wire up):
Pusher (this app uses SSE for realtime — see `docs/realtime.md`), AI
providers, and GitHub/Microsoft/Discord OAuth. Adding one later means: a new
column pair (`*` / `*Encrypted`) on `integration_settings`, a new getter in
`lib/integration-settings.ts`, a new form component, a new section in
`saveIntegrationSettingsAction()`, and one more line on the Settings page and
in the setup wizard.
