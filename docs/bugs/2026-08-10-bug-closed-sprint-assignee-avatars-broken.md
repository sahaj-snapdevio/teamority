# Bug: Assignee avatars broken on the Closed Sprint view

## Symptom

Assignee avatars on the Closed Sprint view (`components/sprint/closed-sprint-view.tsx`)
never rendered a real image — every assignee with an uploaded avatar showed
only the fallback initials, even though the same user's avatar displayed
correctly everywhere else in the app (task rows, sprint board, task detail
panel, etc.).

## Where

`components/sprint/closed-sprint-view.tsx` — `AssigneeAvatars`.

## Root cause

```tsx
<img src={a.image} alt={a.name} />
```

`user.image` (and the `assignee.image` field derived from it) is a **storage
key** (e.g. `avatars/{userId}/{uuid}.webp`), not a URL — per CLAUDE.md's User
Avatars convention, it must be resolved through `avatarSrc(key)` (→
`/api/files/${key}`) or the shared `UserAvatar` component before it can be
used as an `<img src>`. This file used the raw storage key directly as the
`src`, so the browser requested a nonexistent path
(`/avatars/{userId}/{uuid}.webp` relative to the current page) and silently
fell through to the broken-image state — with no fallback shown, since this
predated the `Avatar`/`AvatarFallback` primitive being used here at all.

Found incidentally while clearing pre-existing `biome` `lint/performance/noImgElement`
lint debt across the repo — the fix required inspecting what the `<img>` was
actually rendering, which surfaced the storage-key-as-URL bug.

See `2026-08-10-solution-closed-sprint-assignee-avatars-broken.md`.
