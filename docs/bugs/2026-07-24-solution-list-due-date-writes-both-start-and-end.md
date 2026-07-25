# Solution — Setting a due date in the list quick-edit writes BOTH start and end date

**Date:** 2026-07-24
**Bug:** `2026-07-24-bug-list-due-date-writes-both-start-and-end.md`

## The decision (shared — Agents A & C please converge on this)

> **A "due date" is `dueDateEnd`, and only `dueDateEnd`.**
> A single-field date affordance never writes `dueDateStart`. Start dates are
> set explicitly, on the task detail, where there is a labelled Start Date
> field next to a labelled Due Date field.

This is option 1 from the brief (single field → end date only), chosen over
adding a range picker to the list row. Reasoning: the list cell is a
one-column, one-value affordance labelled "Due Date". A control that writes two
fields cannot be made honest by adjusting what it writes — only by relabelling
it, which the column width doesn't allow. The task detail already provides the
explicit two-field editor for anyone who wants a range.

**The corollary matters as much as the rule:** if a due date only ever *writes*
`dueDateEnd`, it must only ever *read* `dueDateEnd`. A read fallback to
`dueDateStart` makes "clear the due date" look broken (see the bug doc).

## What changed

All in `components/task/task-list-row.tsx`.

### 1. The write is unconditional

```ts
const res = await updateTask(workspaceId, spaceId, effectiveListId, task.id, {
  dueDateEnd: date,
});
```

No branch, no `dueDateStart` in the payload, in either direction. `updateTask`
only touches keys that are explicitly present, so an existing start date is
preserved untouched.

### 2. The read is symmetric

`localDueDate` is now seeded and re-synced from `task.dueDateEnd` alone (the
`?? task.dueDateStart` fallback is gone, in both the initial state and the
sync effect).

### 3. `dueDateStart` is a constraint, not a target

The one place the start date still participates is the calendar's `disabled`
range — a deadline can't be dragged before the task's start:

```tsx
disabled={task.dueDateStart ? { before: new Date(task.dueDateStart) } : undefined}
```

This guard was already on the desktop popover; it is now on the **mobile** card
popover too, which previously let you pick any date at all.

### 4. Clearing is an explicit button

Both popovers gained a **"Clear due date"** action below the calendar, matching
the pattern already used by `components/task/quick-task-meta.tsx`. Previously
the only way to clear was to re-click the already-selected day and rely on
`react-day-picker` emitting `undefined` — undiscoverable, and easy to mistake
for a failed click.

Still shadcn only — `Calendar` inside a `Popover`, no native `<input type="date">`.
`refreshWorkspace` continues to run via `updateTask`, with `onRefresh()` on the
client after a successful write.

## Known related callers (NOT changed here — flagging for the owning agents)

The same `dueDateStart ? … : { dueDateStart: date, dueDateEnd: date }` shape
still exists in files outside this scope:

- `components/task/subtask-row.tsx:160`
- `components/task/task-detail-panel.tsx:417` and
  `app/(app)/[workspaceId]/task/[taskId]/_components/task-detail-page.tsx:660` —
  these two are the **Start Date** field writing `dueDateEnd` when no end
  exists. That direction is arguably fine (a range needs an end), but it is the
  reason `dueDateEnd` is reliably populated, so it should be a deliberate
  decision rather than an accident.

Agent A owns those files. Agent C should apply the same "due date = end only"
rule to the Board card's inline date editor so the two views agree.

## Files touched

- `components/task/task-list-row.tsx`

## Verifying

1. Task with **no dates** → set a due date from the list. Open the task detail:
   Due Date is set, **Start Date is still empty**.
2. Task with an **existing start date** → change the due date from the list.
   The start date is unchanged.
3. Same task → **Clear due date**. The cell goes empty and *stays* empty (it no
   longer falls back to showing the start date).
4. Task with a start date → open the due-date calendar. Days before the start
   are disabled, on both desktop and mobile.
