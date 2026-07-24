# Bug — Activity composer scrolls away with the feed

**Date:** 2026-07-24
**Item:** #1
**Solution doc:** `2026-07-24-solution-activity-composer-scrolls-with-feed.md`

## Symptom

In the task Activity panel, the comment composer is the last item in the feed's normal document flow. On a task with any real history the composer is pushed below the fold, so leaving a comment means scrolling to the bottom of the whole activity list first. It should stay pinned to the bottom of the panel while the activity list scrolls above it.

## Where

`components/task/task-activity-feed.tsx` — the `TaskActivityFeed` render. The same component is mounted on two surfaces:

- the full task page — `app/(app)/[workspaceId]/task/[taskId]/_components/task-detail-page.tsx`, right-hand column
- the drawer — `components/task/task-detail-panel.tsx`, main column

## Root cause

The feed rendered one flat `<div className="space-y-3">` containing the "Activity" label, the feed items, and the composer, and **owned no scroll container of its own**. Scrolling was always the parent's job:

- Full page: the parent wrapper was `<div className="flex-1 overflow-y-auto px-5 py-4">`. Because the scrollport belonged to the parent and the composer was just the last child inside it, the composer scrolled with everything else.
- Drawer: the feed is the last section of a taller `overflow-y-auto` column it shares with description, checklists, time tracking and dependencies — so there was nothing for the composer to pin against either.

Both surfaces therefore had the same defect for the same reason, but they need different fixes: the full page can give the feed the full column height, while the drawer cannot (the feed is one section among several in a column it does not own).
