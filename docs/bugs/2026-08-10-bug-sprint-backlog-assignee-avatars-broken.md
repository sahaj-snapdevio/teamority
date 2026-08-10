# Bug: Assignee avatars broken on the Sprint Backlog view

## Symptom

Assignee avatars in the Sprint Backlog panel (the collapsible "Backlog"
section above the sprint board) never rendered a real image — every
assignee with an uploaded avatar showed only the fallback initials, even
though the same user's avatar displayed correctly elsewhere (task rows,
sprint board, task detail panel).

## Where

- `app/actions/sprint.ts` — `getBacklogTasks`
- `components/sprint/backlog-view.tsx` — `BacklogTaskRow`

## Root cause

Two independent, stacking gaps:

1. **Query dropped the column.** The assignee select in `getBacklogTasks`
   only fetched `taskId`, `userId`, `name`, `email` — `user.image` was never
   selected, and the `BacklogTask["assignees"]` type didn't declare it
   either. Other queries in the same file (`getActiveSprintView`, the
   closed-sprint query) correctly select `image: user.image`; this one was
   the outlier.
2. **Component had no image path.** `BacklogTaskRow` only imported
   `Avatar`/`AvatarFallback` from `components/ui/avatar` — there was no
   `AvatarImage` usage at all, so even a correctly-fetched `image` key would
   have had nowhere to render.

Per CLAUDE.md's User Avatars convention, `user.image` is a storage key
(e.g. `avatars/{userId}/{uuid}.webp`), not a URL, and must be resolved via
`avatarSrc(key)` (→ `/api/files/${key}`) before use as an image `src`.

See `2026-08-10-solution-sprint-backlog-assignee-avatars-broken.md`.
