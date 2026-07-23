# Solution: initialise the dev database as UTF-8

## What was changed

### 1. `scripts/dev-db.ts` — force UTF-8 on cluster init (durable fix)

Passed `initdbFlags` to `EmbeddedPostgres` so freshly-initialised clusters no
longer inherit the host OS's WIN1252 codepage:

```ts
const postgres = new EmbeddedPostgres({
  // …
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});
```

`--locale=C` is encoding-agnostic and is required so `initdb` accepts UTF8
regardless of the host locale (otherwise it insists the locale and encoding
match). This only affects the **first** initialisation of a data directory, so
existing clusters are untouched — which is why step 2 was also needed on this
machine.

### 2. Recreated the existing `krova` database as UTF-8 (this machine)

A database's encoding is fixed at creation and cannot be altered in place, and
the whole cluster (including template0/template1) was WIN1252. With the dev
server stopped, connected to the `postgres` maintenance database and:

```sql
DROP DATABASE krova WITH (FORCE);
CREATE DATABASE krova
  WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C';
```

`template0` + `LC_*='C'` is the standard way to create a UTF-8 database inside a
cluster whose default template is a legacy codepage. Then re-ran `pnpm db:migrate`
to rebuild the schema. This wiped the pre-existing 1 user + 1 workspace (a
half-finished onboarding) — an accepted, confirmed trade-off.

## Why it works

- UTF-8 can represent every Unicode code point, so emoji and non-Latin text now
  store and round-trip correctly.
- The `initdbFlags` change makes this the default for any fresh clone, so the
  bug does not recur on other Windows machines.

## Verification

- New `krova` encoding: `UTF8`.
- `pnpm db:migrate` → `[✓] migrations applied successfully!` (49 public tables).
- Emoji round-trip through the DB returns `👋 Welcome to Smit` intact.

## Notes

- Existing developers with an already-initialised WIN1252 cluster must recreate
  their local database (the step-2 SQL above, or delete the data directory and
  re-run `pnpm db:local`) to pick up UTF-8 — the code change alone does not
  migrate an existing cluster.
- This resolves the "follow-up worth considering" left open in
  `2026-07-23-solution-db-migrate-fails-silently.md`.
