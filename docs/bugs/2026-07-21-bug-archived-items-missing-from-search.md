# Bug: Archived tasks and projects are missing from global search results

**Date:** 2026-07-21
**Area:** Global search — `app/actions/search.ts`, `components/search/search-palette.tsx`

## Symptom
Searching for a task or Project (Space) that has been archived returns no
results, even when the title matches exactly. Users have no way to find
archived items from the search palette — for a task, they have to know which
List it lived in and open its "Show archived" section manually; for a
Project, there's no way in at all once it's archived.

## Where
`globalSearch()` (`app/actions/search.ts`), used by the ⌘K search palette
(`components/search/search-palette.tsx`).

## Root cause
- The task query's WHERE clause unconditionally included `eq(task.isArchived,
  false)`, excluding every archived task from the result set regardless of
  title match.
- The space (Project) query scoped results to `accessibleSpaceIds`, which
  `getAccessibleSpaceIds()` returns as non-archived spaces only by default —
  so an archived Project could never appear even though the user still has
  access to it (visible in the sidebar's "Hide archived projects" section).
