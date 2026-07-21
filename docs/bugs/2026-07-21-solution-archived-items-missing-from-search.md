# Solution: Archived tasks and projects are missing from global search results

**Date:** 2026-07-21
**Area:** Global search — `app/actions/search.ts`, `components/search/search-palette.tsx`

## Fix
- `app/actions/search.ts`: dropped the `eq(task.isArchived, false)` condition
  from `globalSearch()`'s task query, so archived tasks are included whenever
  they match the title/filters. Added `isArchived: task.isArchived` to the
  select and to the `SearchTaskResult` type. The task's List still has to be
  unarchived (`eq(list.isArchived, false)` is unchanged) — search for tasks
  inside archived Lists stays a separate, documented behavior
  (`docs/search-and-filters.md` § Business Rules #2), not part of this fix.
  Existing ranking (`orderBy(desc(task.updatedAt))`) and all other filters are
  untouched.
- `components/search/search-palette.tsx`: task rows now render a muted,
  line-through title plus an "Archived" pill (`ArchiveIcon`) next to the
  status pill when `t.isArchived` is true — reusing the same muted/line-through
  treatment already used for archived tasks in the List view's archived
  section. Clicking an archived result still routes to
  `/[workspaceId]/task/[taskId]` like any other task; the task detail page
  already supports viewing (read-only) an archived task.

- Same gap existed for archived Projects (Spaces): `globalSearch()` scoped the
  space query to `accessibleSpaceIds`, which `getAccessibleSpaceIds()` only
  populates with non-archived spaces by default. Fixed by also fetching the
  user's accessible *archived* space ids (`getAccessibleSpaceIds(userId,
  workspaceId, true)`) and including them in the space query's `inArray`, plus
  `isArchived: space.isArchived` on the select and `SearchSpaceResult` type.
  `components/search/search-palette.tsx`'s Projects section gets the same
  muted/line-through + "Archived" pill treatment as tasks. Task/List search
  scope is intentionally untouched — they stay limited to non-archived spaces
  per the existing business rule.

- Archived Projects surfaced by the fix above 404'd when clicked: unlike
  archived Tasks, there is no viewable page for an archived Space anywhere
  in the app today — `[workspaceId]/[spaceId]/page.tsx` gates on
  `canAccessSpace()`, which (like `getAccessibleSpaceIds()`) only recognizes
  non-archived spaces, and the sidebar's "Archived projects" section only
  offers Unarchive, never a link to open one. Rather than build net-new
  archived-space viewing (out of scope here, and `canAccessSpace()` is the
  shared gate for edit/create actions elsewhere — loosening it globally would
  also loosen those), `navigateSpace()` in `search-palette.tsx` now checks
  `s.isArchived` and shows an info toast ("… is archived. Unarchive it from
  the sidebar to open it.") instead of navigating, the same pattern already
  used for non-navigable notification targets
  (`lib/notifications/target.ts` → `getNotificationTarget()`'s `"info"` type).

## Why it works
Both exclusions were unconditional WHERE-clause/scoping gaps with no
corresponding UI toggle — removing them makes archived tasks and archived
projects searchable by title again, and the new badges keep their status
visually distinct from active items so users aren't confused about what
they're opening. For archived Projects specifically, redirecting the click to
an explanatory toast (instead of a route that doesn't exist) avoids the 404
without expanding what an archived Space can be used for.
