# Bug — Placeholder VAPID keys crash the server

**Date:** 2026-07-24

## Symptom

Any page that runs a server action (e.g. `/setup`) fails to render with a runtime error:

```
Vapid public key should be 65 bytes long when decoded.

    at module evaluation (lib/notifications/push.ts:19:11)
    at <anonymous> (lib/notifications/create-notification.ts:18:1)
    ...
    at <anonymous> (app/actions/workspace.ts:14:1)
```

The failure has nothing to do with notifications — it takes down unrelated pages.

## Where

- `lib/notifications/push.ts` — the module-scope `webpush.setVapidDetails(...)` call.
- Triggered by `.env` still holding the `.env.example` placeholders:
  `VAPID_PUBLIC_KEY=your_public_key_here`, `VAPID_PRIVATE_KEY=your_private_key_here`.

## Root cause

Two problems compounding:

1. `.env` was copied from `.env.example` and the Web Push section was never filled in.
   The keys are *optional*, but the placeholders are non-empty strings, so
   `isConfigured()` (a plain truthiness check on the three `VAPID_*` vars) returned
   `true` for values that are not valid keys.

2. `webpush.setVapidDetails()` **validates and throws** on a malformed key, and it was
   called at **module evaluation** time. `lib/notifications/push.ts` is imported by
   `lib/notifications/create-notification.ts`, which every server action pulls in
   transitively — so a throw during module init propagated up the whole import chain and
   crashed page render, not just push delivery.

Push notifications are an optional feature; a misconfigured optional feature should
degrade to "off", never take the app down.
