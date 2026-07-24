# Solution — Settings page headers moved into the topbar

**Date:** 2026-07-24
**Items:** #10, #14
**Bug doc:** `2026-07-24-bug-settings-page-header-duplicated-in-content.md`

## What changed

Added a one-purpose client shim, `TopbarTitle`, so **server** layouts can fill the existing topbar slot. No change to `workspace-shell.tsx` or `topbar-context.tsx` — the slot mechanism was already there and is reused as-is.

### New file

**`components/common/topbar-title.tsx`**

```tsx
export function TopbarTitle({ breadcrumbs = [], title }) {
  useSetTopbar({ breadcrumbs, title });
  return null;
}
```

It takes plain serializable props, calls `useSetTopbar`, and renders nothing. A server layout mounts it like any other client component.

### Files touched

| File | Change |
|---|---|
| `app/(app)/[workspaceId]/[spaceId]/list/[listId]/settings/layout.tsx` | Removed the `<h1>` / subtitle / "Back to list" block; mounts `<TopbarTitle breadcrumbs={[{ label: listName, href: <list url> }]} title="Settings" />`. Dropped the now-unused `Link` and `ArrowLeftIcon` imports. |
| `app/(app)/[workspaceId]/[spaceId]/settings/layout.tsx` | Same pattern — crumb links to the project landing page, title `"Settings"`. |
| `app/(app)/[workspaceId]/settings/layout.tsx` | Removed the `<h1>`; `<TopbarTitle title="Workspace Settings" />` (no crumb — workspace settings has no parent page). |
| `app/(app)/[workspaceId]/notifications/settings/page.tsx` | Already a client component, so it calls `useSetTopbar` directly (crumb "Inbox" → `/{workspaceId}/notifications`, title "Notification Settings"). Removed the `<h2>`; kept the one-line description as body copy since the topbar has no subtitle slot. |

## Why it works

`useSetTopbar` writes into the same context `TopbarRightColumn` reads, so the settings title renders in the topbar exactly like List/Board/Sprint titles do, with matching spacing and typography. The hook's cleanup (`setState(null)` on unmount) already handles navigating away; the layouts persist across settings sub-routes, so switching tabs inside settings doesn't flicker.

**"Back to list" stays reachable:** the topbar breadcrumb entry is a real `<Link>` to the list (the shell renders `crumb.href` crumbs as links). Same for Project Settings → project landing page. That replaces the separate back-link rather than dropping the affordance.

## Cross-agent note (announced)

**No topbar restructuring was needed.** The task file anticipated editing `components/workspace/workspace-shell.tsx`; it turned out unnecessary because the title/breadcrumb slot already exists there. `workspace-shell.tsx` is **untouched**, so Agent A's pin-indicator work on the topbar (#7) has no conflict with this change.

## Also fixed on the notification settings page

While in the file, two Definition-of-Done violations were corrected:

- Native `<input type="time">` for the digest send time → shadcn `Select` with half-hour slots. A previously-stored off-slot value (e.g. `08:15`) is prepended as an extra option so it stays selectable rather than being silently blanked.
- `rounded-lg` card surfaces → `rounded-xl` (three containers), per the UI Consistency rule in `CLAUDE.md`.
