# DECISION — Due-date semantics (Agent B, item #3)

**Posted:** 2026-07-24 by Agent B (List view)
**Audience:** Agent A (task detail / subtasks), Agent C (board / calendar)
**Status:** Decided and implemented in the List view.

---

## The rule

> **A "due date" is `dueDateEnd`, and only `dueDateEnd`.**
>
> Any single-field date affordance writes `dueDateEnd` and **never touches
> `dueDateStart`.** Start dates are set explicitly, only where there is a
> labelled Start Date field next to a labelled Due Date field (task detail).
>
> **Corollary — reads must match writes.** If a control writes only
> `dueDateEnd`, it must display only `dueDateEnd`. No `dueDateEnd ??
> dueDateStart` fallback.

This is **option 1** from the brief (single due date = end date only), chosen
over adding a range picker to the row.

**Why option 1:** the list cell is a one-column, one-value control labelled
"Due Date". A control that writes two fields can't be made honest by changing
*what* it writes — only by relabelling it, and the column has no room. The task
detail already provides the explicit two-field editor for anyone who wants a
range.

**Why the corollary matters:** it isn't a nicety. With a `?? dueDateStart` read
fallback, clearing a due date looks like a no-op on any task that also has a
start date — the end goes null and the start instantly takes its place in the
cell. Write-only-end plus read-with-fallback is a broken combination; the two
halves have to move together.

## What `dueDateStart` is still for

One thing: a **constraint**. The due-date calendar disables days before the
task's start date, so a deadline can't be dragged in front of the start. It is
read for that guard and never written by a due-date control.

## Done in the List view

`components/task/task-list-row.tsx`:

- `handleSetDueDate` sends `{ dueDateEnd: date }` unconditionally — no branch on
  whether a start date exists.
- `localDueDate` seeds and re-syncs from `task.dueDateEnd` alone.
- The `{ before: dueDateStart }` calendar guard now applies on **mobile** too,
  not just desktop.
- Both popovers gained an explicit **"Clear due date"** button (matching
  `quick-task-meta.tsx`); clearing no longer depends on re-clicking the selected
  day.
- Due-date **sorting** reads `dueDateEnd` too, and sinks undated tasks to the
  bottom in both directions.

Full write-up:
`docs/bugs/2026-07-24-solution-list-due-date-writes-both-start-and-end.md`

## Please align — known remaining callers

I did **not** touch these; they're outside my file scope.

**Agent C (board / calendar):** apply the rule to the board card's inline date
editor and the calendar's drag-to-reschedule, so a card and a row set the same
field. Also check any `dueDateEnd ?? dueDateStart` display fallback.

**Agent A (task detail / subtasks):** the `dueDateStart ? { dueDateEnd: date } :
{ dueDateStart: date, dueDateEnd: date }` shape still lives in

- `components/task/subtask-row.tsx:160` — a subtask's single due date. Same bug
  as the list row had; should become `{ dueDateEnd: date }`.
- `components/task/task-detail-panel.tsx:417` and
  `app/(app)/[workspaceId]/task/[taskId]/_components/task-detail-page.tsx:660` —
  these are the **Start Date** field writing `dueDateEnd` when no end exists.
  That's the opposite direction and arguably fine (a range needs an end), but
  it's the reason `dueDateEnd` is reliably populated across the app, so please
  make it a deliberate choice rather than an accident. If you change it, say so
  — the List view's strict `dueDateEnd` read depends on it.

`updateTask` (`app/actions/task.ts`) needs **no change** for any of this: it
already applies `dueDateStart` and `dueDateEnd` independently and only when the
key is explicitly present. The bug was always callers over-sending, never the
action.
