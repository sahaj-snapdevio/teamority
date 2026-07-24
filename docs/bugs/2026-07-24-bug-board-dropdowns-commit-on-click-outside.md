# Bug — Board card dropdowns look like they only commit on click-outside

**Date:** 2026-07-24
**Item:** #16

## Symptom

On a Board card, open the **assignee** picker and click a member: nothing appears to happen. The picker stays open with the same rows. Click anywhere outside and the card is suddenly showing the new avatar — so the change reads as "committed by the outside click", not by the option click.

**Duplicate** behaves the same way: hover a card → "…" → Duplicate, and the menu just sits there. Click away and the duplicated card is there.

## Where

`app/(app)/[workspaceId]/[spaceId]/list/[listId]/_components/board-view.tsx`, inside `CardContent`:

- the assignee `Popover` + `handleToggleAssignee`
- the hover quick-actions "More" `Popover` (Duplicate, Archive, Copy link, Copy ID, Delete)

## Root cause

The mutation was firing on click all along. What was missing is that **nothing closed the popover, and nothing on screen changed until the server round-trip landed.**

`handleToggleAssignee` awaited `addAssignee` / `removeAssignee` and then called `onRefresh()` → `router.refresh()`. Every avatar on the card renders from the `task` prop, which only updates once that RSC refetch resolves and `BoardView` re-syncs `localTasks`. Meanwhile the open `PopoverContent` (`w-64`, `side="bottom"`, `align="end"`) sits directly over the avatar stack it anchors to — so during the round-trip there is nothing to see, and afterwards the result is behind the popover. The next outside click dismisses the popover and reveals a card that changed some time earlier.

The "More" menu is worse because it was an **uncontrolled** `<Popover>` with no open state at all. Radix doesn't close a popover when an arbitrary `<button>` inside its content is clicked — only a `PopoverClose`, Escape, or an outside interaction does. So `handleDuplicate` ran, `flashDuplicatedTask` highlighted the new card, and the menu stayed parked on top of it.

Priority and due-date were already correct — `handleSetPriority` / `handleSetDueDate` both call `setPriorityOpen(false)` / `setDateOpen(false)` as their first statement, before awaiting. That contrast is what made assignee and Duplicate look uniquely broken.

Board cards have no inline **status** picker (status is the column), so there was nothing to fix there.
