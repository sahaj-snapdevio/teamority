# Time Tracking

## Overview

A live timer + manual time log feature (ClickUp-style MVP), scoped to a single Task. Every workspace member with edit access on the Task's Project can start/stop a timer or log a completed block of time; everyone with view access sees the resulting history.

This is a **separate concern from `Task.timeEstimate`** (a single planning field on the task, untouched by this feature) — see the Task Fields table in [task.md](./task.md).

---

## User Stories

- As a Member, I want to start a timer when I begin working on a task, and stop it when I'm done, so my time is tracked without manual math.
- As a Member, I want to log a block of time I already worked (e.g. yesterday afternoon) without having run a live timer for it.
- As a Member, I want to add a short note to a time entry describing what I worked on.
- As a Member, I want to see a history of everyone's tracked time on a task, grouped by day and by person.
- As a Member, I want to delete my own time entry if I logged it by mistake.
- As a Member, I want starting a new timer to automatically stop any timer I already have running elsewhere, so I never have two running at once.

---

## Data Model

`timeEntry` (`db/schema/time-tracking.ts`) — one row per timer session or manual log:

```
timeEntry
├── id                (text, primary key)
├── task_id           (FK → task, onDelete: cascade)
├── workspace_id       (FK → workspace, onDelete: cascade — denormalized for "my running timer" lookups without a join)
├── user_id           (text)
├── start_time        (timestamptz)
├── end_time           (timestamptz, nullable — NULL means the timer is currently running)
├── duration_seconds  (integer, nullable — NULL while running; set on stop or immediately for a manual log)
├── description        (text, nullable — optional note)
├── created_at / updated_at
```

Indexes:
- `time_entry_task_id_idx` on `task_id`
- `time_entry_one_running_uq` — a **partial unique index** on `user_id` where `end_time IS NULL`, enforcing at most one running timer per user at the database level. The app also auto-stops any existing running timer on `startTimer` as a belt-and-braces UX (see below), but the DB constraint is the real guarantee.

A manual log (`logTime`) is stored as a row with `start_time === end_time` — it's not a real interval, just a dated block.

---

## Actions

All in `app/actions/time-tracking.ts`, gated by `requireEditAccess` (edit permission or above on the Project):

| Action | Behavior |
|--------|----------|
| `startTimer(workspaceId, spaceId, listId, taskId)` | Starts a timer on `taskId`. If the caller already has a running timer (on any task, any workspace), it is auto-stopped first inside the same transaction. Returns the started task's title, plus the auto-stopped task's title if applicable (drives a two-line toast). |
| `stopTimer(workspaceId, spaceId, listId, taskId)` | Stops the caller's running timer on `taskId`, computing `duration_seconds = now - start_time` server-side. Returns `{ entryId, seconds }` — the UI uses this to offer an optional note **after** the stop (see below). |
| `setTimeEntryNote(..., entryId, note)` | Sets or clears the note on a completed entry. Allowed for the entry's author, or any user with `full_access` on the Project. Empty string clears the note. No activity log entry — the entry's own history row is enough. |
| `logTime(..., input: { hours, minutes, date, description? })` | Inserts a completed entry directly with `start_time = end_time = date`. Rejects a non-positive duration or invalid date. |
| `deleteTimeEntry(..., entryId)` | Deletes an entry. Allowed for its author, or any user with `full_access`. No activity log entry. |

**Why the note is collected after the stop, never before:** `stopTimer`'s duration is `now - start_time`, computed server-side at the moment of the call. If a note prompt appeared *before* the stop was recorded, the time spent typing the note would inflate the tracked duration. `stopTimer` returns immediately, and the UI's `StopNoteDialog` attaches the note via a separate `setTimeEntryNote` call afterward — "Skip" is a valid, harmless no-op.

Every mutation that changes tracked time (`startTimer`, `stopTimer`, `logTime`) writes an activity log entry (`timer_started` / `timer_stopped` / `time_logged` — see `lib/activity-log.ts`) and calls `refreshWorkspace` so open task views and card badges update live. `setTimeEntryNote` and `deleteTimeEntry` do not write activity log entries, by design, to keep the feed from getting noisy over incidental edits.

**Never write to `timeEntry` on a per-second interval.** The live running clock shown in the UI ticks entirely client-side (a `setInterval` re-render, see below) — the database is only touched on start/stop/log/delete/note.

---

## UI

One shared component, `components/task/task-time-tracking.tsx` (`TaskTimeTracking`), used by both the full task page's accordion section and the task drawer panel (`hideHeader` prop suppresses the built-in "Time Tracking" heading when a parent section already supplies one).

- **Tracked Time total + Start/Stop control** — shows the sum of all completed entries plus, if a timer is running (by anyone), a live-ticking addition computed client-side from `now - start_time` each second. The caller's own Start/Stop button reflects only *their* running timer; if someone else's timer is running, the total still updates live but no Stop button is shown to the caller for it.
- **Log Time** — opens a dialog to enter hours/minutes, a date (shadcn `Calendar` popover), and an optional description.
- **History** — completed entries grouped by calendar day (`Today` / `Yesterday` / `MMM d, yyyy`), then by user within each day (collapsible, ordered by that user's total descending). Each session row shows a time range (`h:mm a – h:mm a`, or a single timestamp for a manual log where start equals end), duration, and an optional note. Only the entry's own author can delete it inline, and only while it's their own row.
- **Card badge** — `components/task/tracked-time-badge.tsx` (`TrackedTimeBadge`) renders a small clock icon + `formatDuration` total on List/Board task cards, showing only **completed** tracked time (never counts a currently-running timer). Renders nothing if the total is zero.

---

## Formatting

`lib/format-duration.ts` — reuse these, don't reformat duration values inline:

- `formatDuration(seconds)` — compact human total: `"3h 42m"`, `"45m"`, `"3h"`, or `"45s"` for anything under a minute (so a genuine short entry isn't indistinguishable from zero).
- `formatTimer(seconds)` — running-clock display: `"HH:MM:SS"` (hours grow past two digits for very long sessions).

---

## Permissions

- **Start/stop a timer, log time, or delete your own entry:** edit access or above on the Project (`requireEditAccess` — same gate as editing the task itself).
- **Edit or delete someone else's entry:** requires `full_access` on the Project (Owner/Admin/Full Access) — checked via `getSpacePermission` + `hasPermissionLevel(..., "full_access")`.
- **View the time-tracking section and history:** anyone with view access to the task.

---

## Out of scope (do not build)

Per the MVP scope, none of the following exist and should not be added without a separate design pass:

- Time estimates or remaining-time tracking (that's `Task.timeEstimate`, a separate untouched field)
- Billable time / hourly rates
- Timesheets or CSV export / reports
- Pomodoro-style timers, idle detection, or screenshots
- A tracked-time badge on Sprint or My Tasks views
- A global topbar timer widget showing the current running timer outside the task itself
