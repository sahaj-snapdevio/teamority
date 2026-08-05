# Bug: assignee avatar image renders above the sticky list header on scroll

## Symptom

On the List view (`/[workspaceId]/[spaceId]/list/[listId]`), the filter
toolbar (Search, Status, Priority, Assignee, Sort, Group By, Archived) is a
sticky header pinned under the page title while the task rows scroll
underneath it. When a task row with an assigned member scrolled past the
sticky header, the assignee's avatar image painted **on top of** the header
instead of disappearing beneath it.

Not List-view-specific: any scrollable list of `Avatar`s sitting under a
sticky/fixed element with `z-10` (or lower) could show the same overlap,
since the defect is in the shared `Avatar` primitive.

## Where

- `components/ui/avatar.tsx` — `Avatar`, `AvatarImage`, `AvatarFallback`
- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/list-view.tsx:2518` — the sticky filter toolbar (`sticky top-14 z-10`)
- `components/task/task-list-row.tsx` — renders the per-row `Avatar` for assignees (desktop cell, read-only cell, mobile card)

## Root cause

`AvatarImage` and `AvatarFallback` are `position: absolute` (`inset-0`), and
`AvatarImage` additionally sets `z-10`. The `Avatar` root `span` that wraps
them, however, was never given `position: relative` — so it did not act as
their containing block or as a stacking-context boundary.

Without a positioned/`isolate`d ancestor scoped to the avatar itself, the
image's `z-10` was evaluated against whatever the *nearest actual
stacking-context-establishing ancestor* happened to be — which, for a task
row, was effectively the same stacking level as the page's other `z-10`
elements, including the List view's sticky toolbar
(`list-view.tsx:2518`, `sticky top-14 z-10`). Since task rows are later in
the DOM than the header, an equal `z-index: 10` tie was broken in the row's
favor, so the avatar painted over the sticky header instead of under it.

This is a shared-primitive bug, not a List-view bug: every consumer of
`Avatar` was exposed to the same risk of its internal `z-10`/`z-20`
(`AvatarBadge`) leaking into whatever global stacking context it happened to
render in.

See `2026-08-05-solution-avatar-image-renders-above-sticky-header.md`.
