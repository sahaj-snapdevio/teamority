# Solution: Assignee avatars broken on the Closed Sprint view

## What changed

`components/sprint/closed-sprint-view.tsx` — `AssigneeAvatars` now uses the
shared `Avatar`/`AvatarImage`/`AvatarFallback` primitives (`components/ui/avatar.tsx`)
with `avatarSrc(a.image)` resolving the storage key to a real URL, instead of
passing the raw storage key straight into a native `<img src>`:

```tsx
<Avatar ...>
  {a.image && <AvatarImage alt={a.name} src={avatarSrc(a.image)} />}
  <AvatarFallback className="text-[9px] font-semibold text-base-content/60">
    {initials}
  </AvatarFallback>
</Avatar>
```

This mirrors the identical pattern already used for assignee avatars in
`components/sprint/sprint-list-view.tsx` and `components/task/task-list-row.tsx`.

## Why it works

`avatarSrc()` converts the stored key into `/api/files/${key}`, the route
that actually serves the file (local `fs` adapter in dev, S3/R2/GCS in prod)
— matching every other avatar-rendering call site in the codebase per
CLAUDE.md's User Avatars convention. Using the `Avatar` primitive also gives
users without an uploaded avatar a proper initials fallback instead of a
broken-image icon, which the raw `<img>` never had.

## Files touched

- `components/sprint/closed-sprint-view.tsx`
