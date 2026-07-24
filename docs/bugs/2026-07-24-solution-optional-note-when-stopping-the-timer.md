# Solution — Optional note when stopping the timer

**Date:** 2026-07-24
**Item:** #6 (scope add — approved before building)
**Type:** Feature, not a bug fix, so there is no paired bug doc.

## Scope note

Item #6 was flagged as an addition beyond the documented Time Tracking MVP and required product sign-off. It was **approved**. Investigation before building narrowed it considerably:

- `timeEntry.description` (`db/schema/time-tracking.ts`) **already exists** — nullable `text`. **No migration was needed.**
- `logTime` already accepts and persists `description`, and `LogTimeDialog` already has a "Description (optional)" input.
- The history list in `TaskTimeTracking` already renders `e.description` under each session.

So the only genuine gap was the **timer-stop** path. Everything below is confined to it.

## What changed

### `app/actions/time-tracking.ts`

**`stopTimer` now returns the stopped entry.**

```ts
): Promise<{ ok: true; entryId: string; seconds: number } | { error: string }>
// …
return { ok: true, entryId: running.id, seconds };
```

**New action `setTimeEntryNote(workspaceId, spaceId, listId, taskId, entryId, note)`.** Sets (or, on an empty string, clears) `description` on a completed entry. Permission rule is copied from `deleteTimeEntry`: the entry's author, or a user with `full_access` on the space. Writes no activity log — the entry's own history row already displays the note. Calls `revalidateList` → `refreshWorkspace` like every other mutation in the file.

### `components/task/task-time-tracking.tsx`

`handleStop` records the stopped entry in a `noteFor` state, which renders a new `StopNoteDialog`: shadcn `Dialog`, a single optional `Input` ("What did you work on?"), **Skip** and **Save note**. Enter submits. Skipping, closing, or saving an empty note is a no-op.

## Why the note is collected *after* the stop, not threaded through `stopTimer`

The task file suggested threading an optional `note` parameter through `stopTimer`. That would require the note to exist **before** the stop is written — i.e. prompting the user first and stopping when they submit.

`stopTimer` computes the duration server-side as `now - startTime` at the moment it runs. Prompting first means every second the user spends typing the note lands inside the recorded duration, and a dialog left open over lunch would silently bill hours to the task. So:

1. Clicking **Stop Timer** writes the stop immediately — the duration is exactly what the user tracked.
2. The dialog then opens over the already-saved entry and attaches the note via `setTimeEntryNote`.

`stopTimer` therefore keeps its parameter list and gains only a richer return value (`entryId` is what makes step 2 addressable). It has one caller, which was updated.

## Invariants preserved

- **One running timer per user** — untouched. `setTimeEntryNote` only writes `description`/`updatedAt` and never touches `endTime`, so the partial-unique index and the auto-stop-on-start behaviour are unaffected.
- **No per-second writes** — the live clock stays client-side; the note adds exactly one extra write, and only when the user actually types one.
- **Empty note allowed** — `handleSave` short-circuits to a plain close when the input is blank, so no request is made; and the action itself normalises `""` to `null` if it is ever called with one.

## Out-of-scope items from `CLAUDE.md` — still not built

Estimates, remaining time, billable/rates, timesheets, reports, CSV, pomodoro, idle/screenshot, the Sprint & My-Tasks badge, and the global topbar timer widget remain unbuilt. `task.timeEstimate` is untouched.

## Follow-up

`CLAUDE.md` § Time Tracking should note that `stopTimer` returns `{ entryId, seconds }` and that `setTimeEntryNote` is the fifth action in the set — see the entry added there alongside this change.
