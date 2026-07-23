# Solution: make `pnpm db:migrate` honor `.env` and keep migrations ASCII-only

## What was changed

### 1. `drizzle.config.ts` — load `.env` like the rest of the app

Added the same guard every `tsx`-based script already uses, so drizzle-kit
resolves `DATABASE_URL` from `.env` instead of silently falling back to
`DEV_DATABASE_URL`:

```ts
import { existsSync } from "node:fs";
// …
if (existsSync(".env")) {
  process.loadEnvFile();
}
```

With this, `db:migrate` / `db:generate` / `db:push` connect with the exact same
credentials as `pnpm dev` and `scripts/migrate.ts`. No more `28P01`.

### 2. Sanitized non-ASCII characters in two migration comments

Purely comment text — no DDL or data changed:

- `db/migrations/0009_sprint_space_id.sql`: `FK → space` → `FK -> space`
- `db/migrations/0014_pretty_wong.sql`: two em dashes (`—`) → hyphens (`-`)

## Why it works

- **Env loading:** `process.loadEnvFile()` (Node 20.12+) populates
  `process.env.DATABASE_URL` before `defineConfig` evaluates it, so the
  `?? DEV_DATABASE_URL` fallback — and its fragile `.krova-postgres`-directory
  heuristic — is bypassed whenever a `.env` exists. This matches the pattern in
  `scripts/migrate.ts`, `scripts/dev-db.ts`, etc.
- **ASCII comments:** the local dev database is WIN1252-encoded. Postgres
  transcodes the whole query string (comments included) from client to database
  encoding, so any code point without a WIN1252 equivalent aborts the
  statement. Keeping migration SQL ASCII-only makes them portable across any
  server/database encoding.
- **Safe to edit already-shipped migrations:** the drizzle migrator gates
  application by each entry's `folderMillis` timestamp (from
  `meta/_journal.json`), not by file hash. Environments that already applied
  0009/0014 skip them by timestamp; only under-migrated or fresh databases run
  the sanitized versions.

## Verification

- `pnpm db:migrate` → `[✓] migrations applied successfully!`
- `drizzle.__drizzle_migrations` shows all 20 migrations applied.
- Re-scanned every file in `db/migrations/` — zero non-ASCII bytes remain.

## Follow-up worth considering (not done here)

The local `krova` cluster being WIN1252 is the deeper environmental smell; a
UTF-8 dev database would tolerate non-ASCII SQL. Recreating it with UTF-8 is a
destructive, opt-in operation, so it was left alone. A lightweight guard (a
lint/CI check rejecting non-ASCII bytes in `db/migrations/*.sql`) would prevent
regressions regardless of dev DB encoding.
