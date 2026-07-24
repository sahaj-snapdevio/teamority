# Bug — Board "Add task" shows Priority and Status as multi-select checkboxes

**Date:** 2026-07-24
**Item:** #17

## Symptom

In the Board column composer ("Add task" at the bottom of a column) → **+ More options**, the Priority and Status chips open lists whose rows each carry a **square checkbox**. A task has exactly one priority and exactly one status, so the control advertises something it can't do: it looks like you could tick Urgent *and* High.

The popover also stays open after a pick, reinforcing the "keep ticking" reading.

## Where

- `components/task/quick-task-meta.tsx` — `QuickTaskMeta`, the Priority / Status / Sprint chips (and its `MetaChip` wrapper).
- `components/filters/facet-filter.tsx` — `FacetOptionList`, which renders the rows.
- Reached from `quick-create-task.tsx` (the Board column composer and the List View inline composer).

Not the toolbar **Create Task** modal — `components/task/create-task-modal.tsx` already renders both fields as single-select rows with a trailing check, and closes on pick.

## Root cause

`QuickTaskMeta` was already passing `single` for Priority, Status and Sprint, and `FacetOptionList`'s `handleToggle` honoured it correctly:

```ts
onChange(single ? (selected.includes(value) ? [] : [value]) : toggle(selected, value));
```

But `single` only affected **behaviour**, never **appearance**. The row indicator was hardcoded to a square, checkbox-styled `<span>` (`rounded-none border border-input`, filled with a `CheckIcon` when active) for every caller. So a correctly-behaving radio list was drawn as a checkbox list — the control was lying about itself, and the only way to discover it was single-select was to pick twice and watch the first choice vanish.

The open-state half is `MetaChip`: it wrapped its children in a bare uncontrolled `<Popover>` with no handle on the open state, so it had no way to close on selection. `FacetOptionList` already exposes the hook for this (`onAfterToggle`, which `FacetFilter` uses to close itself when `single`) — `MetaChip` just had nowhere to put it.
