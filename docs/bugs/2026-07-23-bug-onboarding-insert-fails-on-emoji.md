# Bug: onboarding task insert fails on emoji in title (WIN1252 dev database)

## Symptom

During onboarding, `createOnboardingSpace` throws a `DrizzleQueryError` inserting
the sample "Welcome" task:

```
Failed query: insert into "task" (...) values (...)
params: ..., 👋 Welcome to Smit, ...
```

The runtime error surfaces at `app/actions/onboarding.ts:202` via
`app/(app)/onboarding/page.tsx`. Any insert containing an emoji or non-Latin-1
character (task titles, comments, workspace names) fails the same way.

## Where it happened

- Trigger: `app/actions/onboarding.ts` → `createOnboardingSpace` (seeds a sample
  task whose title starts with `👋`).
- Real location: the **local dev database**, not the app code. The identical
  insert succeeds on a UTF-8 database.

## Root cause

The bundled embedded-postgres cluster (`.kanbanica-postgres`) was initialised
with the host Windows locale — `English_India.1252` — so the `krova` database
was created with **WIN1252** encoding:

```
encoding/locale: { e: 'WIN1252', datcollate: 'English_India.1252', ... }
```

WIN1252 (Latin-1 superset) cannot represent `👋` (U+1F44B) or any code point
outside its 256-character range. Postgres transcodes incoming query text from
the client encoding (UTF8) to the database encoding on write, so the emoji has
"no equivalent in encoding WIN1252" and the statement is rejected.

This is the same underlying encoding problem that first showed up in
`2026-07-23-bug-db-migrate-fails-silently.md` (non-ASCII characters in migration
comments). There it was worked around by making the SQL ASCII-only; here the
data itself is legitimately non-ASCII, so the database encoding had to be fixed.

See the paired solution: `2026-07-23-solution-onboarding-insert-fails-on-emoji.md`.
