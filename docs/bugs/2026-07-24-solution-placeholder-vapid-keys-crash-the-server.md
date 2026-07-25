# Solution — Placeholder VAPID keys crash the server

**Date:** 2026-07-24

## What changed

### 1. `lib/notifications/push.ts` — configure VAPID lazily and fail soft

Replaced the module-scope `if (isConfigured()) webpush.setVapidDetails(...)` block with
`ensureVapidDetails()`, called from inside `sendPushToUser()`:

- Runs on first send instead of at module evaluation, so a bad value can no longer throw
  during the import chain that every server action shares.
- Wraps `setVapidDetails()` in `try/catch`. On failure it logs one warning naming the fix
  (`npx web-push generate-vapid-keys`) and sets `vapidReady = false`.
- Caches the result in `vapidReady: boolean | null`, so the warning is logged once per
  process rather than once per notification.
- Invalid keys now take the same path as unset keys: `sendPushToUser()` returns early
  before touching the DB.

### 2. `.env` — real keys

Generated a valid keypair with `web-push` and replaced the `your_*_here` placeholders,
plus a real `VAPID_SUBJECT`. `.env` is gitignored (`.gitignore:33`); `.env.example` keeps
its placeholders, which is correct — it documents the shape, and the code now tolerates
someone copying it verbatim.

## Why it works

The crash was a boot-time throw on an optional dependency. Moving the validating call
behind the same guard that already gates delivery means the worst case for a
misconfigured `VAPID_*` is "push notifications don't send, with a warning in the logs" —
which is exactly what happens when the vars are unset.

## Files touched

- `lib/notifications/push.ts`
- `.env` (local, untracked)

## Verification

`npx vitest run lib/notifications/push.test.ts` — 9/9 pass. The suite mocks `web-push`, so
the lazy path is covered by the existing "does nothing when VAPID is not configured" and
delivery tests; no test changes were needed.
