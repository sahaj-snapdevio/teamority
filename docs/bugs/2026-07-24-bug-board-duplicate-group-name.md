# Bug — Board lets you create two groups with the same name

**Date:** 2026-07-24
**Item:** #9

## Symptom

On the Board view, "Add group" accepts a name that an existing column already uses. The reported screenshot shows two adjacent `HELLO` columns. Nothing distinguishes them — same label, same count badge shape — so cards dropped into "HELLO" land in whichever one the pointer happened to be over, and the Status facet filter lists the name twice.

Renaming an existing status to another status's name (Manage Statuses → Edit) has the same effect.

## Where

- `app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/board-view.tsx` — the "New Group" dialog and `handleCreateGroup`.
- `app/actions/list.ts` — `createListStatus` and `updateListStatus`.
- Secondary entry points onto the same actions: `components/list/list-statuses-settings.tsx` (`AddRow` / `EditRow`), reached from Manage Statuses and the Create Task modal's status menu.

## Root cause

There was no uniqueness constraint on status names at any layer:

- `list_status` (`db/schema/`) has no unique index on `(list_id, name)`.
- `createListStatus` validated only that the trimmed name was non-empty, then inserted.
- `updateListStatus` wrote `data.name.trim()` straight into the update object — it didn't even reject an empty name, so a rename to `"   "` was accepted too.
- The board's `handleCreateGroup` checked `!name` and nothing else, despite already holding the full `statuses` array it would have needed to compare against.

Because the board keys columns by `status.id`, duplicates were entirely legal to the rendering code — the collision is only visible to the user.
