# Bug — Setting a due date in the list quick-edit writes BOTH start and end date

**Date:** 2026-07-24
**Area:** List view → inline "Due Date" cell on a task row

## Symptom

Picking a date from the List view's inline **Due Date** editor wrote
`dueDateStart` **and** `dueDateEnd`, even though the affordance is a single
"Set date" field with no start/end distinction. A user setting a deadline
silently acquired a start date they never asked for.

## Where

`components/task/task-list-row.tsx` — `handleSetDueDate()`, the handler behind
the Due Date cell's shadcn `Calendar` popover (desktop row and mobile card).

## Root cause

The handler branched on whether a start date already existed:

```ts
const patch = task.dueDateStart
  ? { dueDateEnd: date }
  : { dueDateStart: date, dueDateEnd: date };
```

The intent was "keep single-date tasks consistent". The effect was that the
same control did two different things depending on hidden state:

- Task **with** a start date → wrote only the end. Correct.
- Task **without** one → invented a start date equal to the deadline.

So a task the user had deliberately left open-ended became a task that "starts"
the day it is due. Nothing in the UI said this would happen, and nothing in the
list surfaces `dueDateStart`, so the write was invisible until the task detail
page was opened.

There was a second, subtler half to it. The column *read*
`task.dueDateEnd ?? task.dueDateStart`. Once the write was narrowed to the end
date alone, that fallback would make **clearing** a due date look like a no-op
on any task that also had a start date: the end goes null, the start
immediately takes its place in the cell, and the date appears never to have been
cleared.

`updateTask` (`app/actions/task.ts`) was never at fault — it already applies
`dueDateStart` and `dueDateEnd` independently and only when explicitly
provided. This was purely the caller over-sending.

## Impact

Start dates were fabricated on any task given a deadline from the list, and
(for the same reason, in reverse) a pre-existing start date on a task could be
overwritten by a quick deadline edit. Both Board (Agent C) and the task detail
(Agent A) read the same fields, so the bogus start date showed up everywhere.
