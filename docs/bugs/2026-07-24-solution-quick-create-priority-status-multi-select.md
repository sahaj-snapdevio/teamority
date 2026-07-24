# Solution — Draw single-select option lists as radios, and close on pick

**Date:** 2026-07-24
**Item:** #17

## What changed

### `components/filters/facet-filter.tsx`

`single` now drives the indicator as well as the click behaviour. In `FacetOptionList`'s row:

- container: `rounded-none` → `single ? "rounded-full" : "rounded-none"`;
- active content: a filled `bg-primary-foreground` dot when `single`, the existing `CheckIcon` tick when not;
- added `aria-pressed={active}` to the row button (it previously exposed no state at all).

The `<span>` stays presentational, per the existing comment — the row itself is the button, so a real shadcn `Checkbox`/`RadioGroupItem` there would nest buttons. The "Clear" footer was already suppressed for `single` and is unchanged.

The doc comment above `FacetOptionList` now states that `single` means "one value, drawn as a radio", so the next caller doesn't have to read the JSX to find out.

### `components/task/quick-task-meta.tsx`

`MetaChip` owns its open state and takes `children` as a render prop:

```ts
children: (close: () => void) => React.ReactNode
```

- Priority, Status and Sprint pass `onAfterToggle={close}` — one pick, popover closes.
- Assignee and Tags ignore the argument and stay open for further toggles.
- Its `PopoverContent` also picked up `rounded-xl`, matching the UI Consistency rule the other pickers follow.

## Files touched

- `components/filters/facet-filter.tsx`
- `components/task/quick-task-meta.tsx`

## Why it works

The behaviour was already single-select; only the affordance disagreed. Making the indicator follow `single` means the control can't misrepresent itself again — any future caller that passes `single` gets radio visuals for free, and any caller that doesn't keeps checkboxes.

Closing on pick reuses `FacetOptionList`'s existing `onAfterToggle`, the same hook `FacetFilter` uses for its own `single` mode, so there's one mechanism rather than a second ad-hoc one. Clicking the already-selected row still clears it (Priority falls back to `NONE`), which is why the rows are `aria-pressed` toggle buttons rather than strict `role="radio"`.

Every other `single` caller is genuinely single-valued and gains the correct visuals: the Inbox's Date / Workspace / Event filters, `filter-builder.tsx`, `list-filter-toolbar.tsx`, `search-palette.tsx`, and `SINGLE_SELECT` custom fields in `custom-field-editors.tsx` / `custom-field-filter.tsx` / `custom-fields-settings.tsx`. Multi-select lists (assignees, tags, Board's Fields menu, `MULTI_SELECT` fields) are untouched.

Task creation itself is unchanged — `quickMetaCreateFields` already mapped a single `priority` and `statusId` onto `createTask`.
