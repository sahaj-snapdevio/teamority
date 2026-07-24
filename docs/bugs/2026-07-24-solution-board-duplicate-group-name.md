# Solution — Reject duplicate board group names

**Date:** 2026-07-24
**Item:** #9

## What changed

Status names are now unique within a list, compared **case-insensitively and trimmed**, enforced on the server and pre-checked on the client.

### `app/actions/list.ts`

Added a shared helper next to the status actions:

```ts
async function statusNameTaken(listId, name, excludeId?)  // lower(trim(name)) match
function duplicateStatusError(name)                       // one message, one place
```

- `createListStatus` — returns `duplicateStatusError(name)` before inserting when the name is taken.
- `updateListStatus` — now also rejects an empty/whitespace name, and passes `statusId` as `excludeId` so a status renaming to its own name (or just changing colour/type) still saves.

`excludeId` is the reason the check is a helper rather than two inline queries: create and rename need the same comparison with one row's difference.

### `board-view.tsx`

- `handleCreateGroup` compares the trimmed name against the `statuses` prop it already has and short-circuits with an inline error before any request.
- New `groupError` state renders under the input (`text-xs text-destructive`, `aria-invalid` on the `Input`), clears on keystroke, on Cancel, and when the dialog closes.
- The server's error now also lands in `groupError` instead of a toast, so both failure paths surface in the same place, right under the field that caused them.

## Files touched

- `app/actions/list.ts`
- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/board-view.tsx`

## Why it works

The client check is instant feedback, not the guarantee — the `statuses` prop can be stale and two people can add "Review" at the same moment. `statusNameTaken` runs inside the same request that inserts, so every caller of `createListStatus` / `updateListStatus` is covered without touching them: `list-statuses-settings.tsx`'s `AddRow` and `EditRow` already render `res.error` inline, so Manage Statuses and the Create Task modal's status menu picked up the rejection with no changes.

`lower(trim(...))` on both sides means `Hello`, `hello ` and `HELLO` all collide, which is what "duplicate" means to someone reading a column header.

Note this is app-level, not a DB constraint — a unique index on `(list_id, lower(name))` would be stricter but needs a migration plus a cleanup pass over lists that already contain duplicates. Existing duplicates stay as-is; only new creates and renames are blocked.
