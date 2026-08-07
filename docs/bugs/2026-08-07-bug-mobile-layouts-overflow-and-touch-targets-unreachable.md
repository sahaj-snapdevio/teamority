# Bug: Mobile layouts overflow, clip content, or leave actions unreachable on touch

**Date:** 2026-08-07

## Symptom

Across most of the app, layouts were built desktop-first with no mobile
fallback. On viewports in the 320–414px range (and to a lesser extent 768px),
this showed up as:

- Horizontal page overflow from fixed-width elements (search inputs, sidebar
  columns, bulk-action pills, KPI grids, hand-rolled tables) that didn't
  shrink or scroll.
- Content clipped or cut off inside dialogs taller than the viewport (no
  height cap or scroll on `DialogContent`), and inside fixed two-column
  layouts (Task Detail page/drawer, Settings pages) that squeezed both
  columns into a single narrow screen instead of stacking.
- Primary actions that were **only reachable via `group-hover`** — e.g.
  notification row actions, sprint row menus, list-status row menus,
  archived-list "Unarchive" buttons — which never fire on a touch device, so
  the control was invisible and unusable on mobile, not just cramped.
- The admin panel (`app/admin/**`, `app/(orbit)/**`) had no mobile nav at all:
  a fixed `w-60` sidebar with zero responsive handling.
- A few plain `flex-1 truncate` labels missing `min-w-0` on their flex
  parent, so long text (subtask titles, reporter names, status names) pushed
  the row wider instead of truncating.
- The sidebar's account menu (`workspace-shell.tsx`) opens/closes on
  `mouseenter`/`mouseleave` for desktop hover UX. Touch devices still
  dispatch synthetic `mouseenter`/`mouseleave` for taps, including one on
  the trigger button right after tapping a menu item — the item's `onClick`
  closes the popover, which un-covers the trigger right under the finger,
  and the resulting synthetic `mouseenter` reopens it. Net effect: tapping
  any option in the account menu appeared to do nothing, since the popover
  closed and immediately reopened.
- Separately, navigating via any account-menu link (Edit profile, Workspace
  settings, Project settings, Notification settings, Theme) closed the
  account popover but left the mobile sidebar drawer (`sidebarOpen`) open,
  so the destination page rendered underneath/behind the still-open drawer.
  Every other sidebar nav link (Overview, Inbox, My Tasks, project/list
  links, Admin Console) already called `setSidebarOpen(false)` on click —
  the account-menu links were simply missed since the menu is a separate,
  later-added popover.
- Regression from this same pass: the `overflow-x-auto` added to the
  Project/Workspace settings tab strips (`space-settings-nav.tsx`,
  `settings-nav.tsx`) to make them horizontally scrollable on narrow screens
  also introduced an unwanted **vertical** scrollbar on desktop widths.
  Per CSS spec, setting `overflow-x` to a value other than `visible` while
  `overflow-y` stays at its default `visible` implicitly upgrades
  `overflow-y` to `auto` too — so a couple of stray pixels of vertical
  overflow (from the `border-b-2 -mb-px` active-tab underline) was enough
  to show a spurious vertical scrollbar next to the tab row.

## Where it happened

Essentially app-wide — auth/onboarding, the workspace shell (sidebar +
topbar), List/Board/Calendar task views, Task Detail page/drawer/comments,
Workspace Overview, My Tasks, Notifications/Inbox, Settings (workspace/
space/list) + Sprint pages, Profile/Theme/Support/Search/Channel, and both
admin surfaces.

## Root cause

The codebase used Tailwind's desktop-first values as the unprefixed
(mobile) default almost everywhere, with `sm:`/`md:`/`lg:` variants only
added for a handful of components. There was no default safety net at the
primitive level either — e.g. `DialogContent` capped width on mobile
(`max-w-[calc(100%-2rem)]`) but had no `max-height`/scroll, so any dialog
taller than the viewport just overflowed. Interactive affordances that rely
on `:hover` (`group-hover:opacity-100`) assume a pointer device and have no
touch equivalent unless explicitly given one (`group-focus-within:` or a
default-visible mobile state). The account menu's hover-open/close JS logic
is the same class of bug one level deeper — it's not just CSS `:hover`
never *triggering* on touch, it's synthetic mouse events touch browsers
*do* dispatch for taps interacting badly with state that assumes a real,
continuously-tracked pointer.
