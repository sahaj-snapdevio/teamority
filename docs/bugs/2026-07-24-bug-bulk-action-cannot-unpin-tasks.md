# Bug — Bulk action can't unpin tasks

**Date:** 2026-07-24
**Area:** List view → bulk-select action bar / Pinned section

## Symptom

Selecting one or more pinned tasks in the List view and reaching for a bulk
"unpin" did nothing. Reported against the PINNED group with a checkbox shown as
selected in the screenshot.

Two separate things were broken, and either one alone was enough to make the
feature look dead:

1. **Pinned tasks could not actually be selected.** The checkbox in a PINNED row
   rendered and responded to hover, but clicking it changed nothing — the row
   never entered the selection, so the bulk bar never appeared for a
   pinned-only selection.
2. **There was no pin or unpin action in the bulk bar at all.** Even with a
   valid selection, the bar offered Assign / Status / Move / Archive / Delete
   and nothing else.

## Where

- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-view.tsx`
  - `PinnedSection` — renders the PINNED group.
  - `BulkActionBar` — the floating bulk-action bar.

## Root cause

### 1. The pinned rows were wired to a no-op

`PinnedSection` rendered each `TaskListRow` with hard-coded selection props:

```tsx
onSelect={() => {}}
selected={false}
```

`TaskListRow` renders a fully functional checkbox from those props, so the
control *looked* live while being permanently unselected and permanently
inert. Every other place that renders a task row (`StatusGroup`) threads the
real `selectedIds` set and `handleSelect` callback through; the pinned section
was the one caller that didn't, and it never received those props to begin
with.

### 2. Pin state was invisible to the bulk bar

`BulkActionBar` only ever received `selectedIds: Set<string>` — a set of ids
with no task data attached. It therefore had no way to know which of the
selected tasks were pinned and which weren't, which is the minimum information
any pin/unpin action needs.

That gap is wider than it looks, because the list page splits its data in two
(`app/(app)/[workspaceId]/[spaceId]/list/[listId]/page.tsx`): pinned tasks are
returned in a separate `pinnedTasks` array and **filtered out** of `tasks`.
Any attempt to recover pin state by looking up the selected ids in the view's
main task array would have found nothing and reported every selection as
"unpinned" — i.e. it would have offered Pin and never Unpin, reproducing the
reported symptom a second time.

## Impact

Bulk unpin was unreachable. Unpinning could only be done one task at a time,
via the ⋯ menu on an individual row ("Unpin from top"). Since a list caps at 5
pinned tasks, clearing the pins was a five-step manual chore.
