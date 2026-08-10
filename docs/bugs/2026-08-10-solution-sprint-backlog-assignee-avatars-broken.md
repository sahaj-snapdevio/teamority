# Solution: Assignee avatars broken on the Sprint Backlog view

## Fix

### `app/actions/sprint.ts`

- `BacklogTask["assignees"]` type now includes `image: string | null`.
- The `assigneeRows` query select in `getBacklogTasks` now selects
  `image: user.image` alongside `name`/`email`.
- The `assigneesByTask` grouping map and its push now carry `image` through
  to the final `BacklogTask.assignees` entries.

### `components/sprint/backlog-view.tsx`

- Imported `AvatarImage` from `@/components/ui/avatar` and `avatarSrc` from
  `@/lib/priority-config`.
- `BacklogTaskRow`'s assignee avatar loop now renders
  `{a.image && <AvatarImage alt={a.name ?? a.email ?? ""} src={avatarSrc(a.image)} />}`
  before the existing `AvatarFallback`, mirroring the pattern already used
  in `components/task/task-list-row.tsx` and `SprintBoardCardContent`
  (`components/sprint/sprint-list-view.tsx`).

## Why it works

`avatarSrc()` converts the stored key into `/api/files/${key}`, which the
`AvatarImage` primitive can actually load; `AvatarFallback` still covers
users with no avatar (or a failed image load), unchanged. This brings the
Backlog view's assignee avatars in line with every other place in the app
that renders them, per CLAUDE.md's User Avatars convention.
