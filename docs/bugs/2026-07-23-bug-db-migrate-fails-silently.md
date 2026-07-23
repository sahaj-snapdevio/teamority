# Bug: `pnpm db:migrate` fails with exit code 1 and no error message

## Symptom

Running `pnpm db:migrate` locally aborts with only:

```
[⡿] applying migrations...[ELIFECYCLE] Command failed with exit code 1.
```

drizzle-kit swallows the underlying Postgres error, so nothing indicates *why*
it failed. The app itself (`pnpm dev`) worked fine.

## Where it happened

- `drizzle.config.ts` — the config drizzle-kit reads for `db:migrate`.
- `db/migrations/0009_sprint_space_id.sql` and `db/migrations/0014_pretty_wong.sql`
  — the migrations that actually failed.
- Local dev database only (the bundled embedded Postgres cluster).

## Root cause

Two independent problems stacked on top of each other, both masked by
drizzle-kit's silent error handling:

1. **drizzle-kit never loaded `.env`.** Unlike the app (Next.js) and every
   `tsx`-based script (`scripts/migrate.ts`, `dev-db.ts`, `create-admin.ts`, …,
   which all call `process.loadEnvFile()`), `drizzle.config.ts` did not. So
   `process.env.DATABASE_URL ?? DEV_DATABASE_URL` fell through to
   `DEV_DATABASE_URL`. That fallback in `config/dev-database.ts` decides
   legacy-vs-new by checking for a `.krova-postgres` directory — but this
   checkout's cluster lives in `.kanbanica-postgres` while still holding the
   **legacy** `krova` role/database. The heuristic therefore chose
   `kanbanica:kanbanica`, credentials the running cluster rejects:

   ```
   28P01  password authentication failed for user "kanbanica"
   ```

2. **Two migrations contained non-ASCII characters in SQL comments.** After
   forcing the correct (`krova`) connection, the next failure was:

   ```
   character with byte sequence 0xe2 0x86 0x92 in encoding "UTF8"
   has no equivalent in encoding "WIN1252"
   ```

   The local `krova` database is **WIN1252-encoded**. Migration
   `0009_sprint_space_id.sql` had a `→` (U+2192) and `0014_pretty_wong.sql` had
   two `—` (U+2014, em dash) — all in decorative `--` comments. Postgres
   converts the entire query text from the client encoding to the database
   encoding *including comments*, and these code points have no WIN1252
   equivalent, so the statement was rejected.

This DB was partially migrated (through idx 8), which is why `0009` was the
first pending migration to hit the encoding wall.

## Diagnosis note

drizzle-kit's `[ELIFECYCLE] exit code 1` hides the real cause. Running the
`drizzle-orm/postgres-js` migrator directly (a throwaway script that prints
`error.cause`) is how the actual Postgres error codes (`28P01`, then the
encoding error) were surfaced.

See the paired solution: `2026-07-23-solution-db-migrate-fails-silently.md`.
