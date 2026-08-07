# Solution: Mobile layouts overflow, clip content, or leave actions unreachable on touch

**Date:** 2026-08-07

## Approach

Mobile-only responsiveness pass: every change adds a responsive Tailwind
variant (unprefixed classes = mobile default, `sm:`/`md:`/`lg:` restores the
existing desktop appearance) — nothing was redesigned, and no `md:`/`lg:`+
class was removed anywhere in the diff (verified). Two shared primitives
were fixed first since they cascade everywhere; everything else was fixed
per feature area.

## Shared primitives (fix once, benefits every page)

- `components/ui/dialog.tsx` — `DialogContent` now has a default
  `max-h-[85vh] overflow-y-auto` safety net (previously unbounded, so tall
  content on a short mobile viewport was simply cut off). Dialogs that
  already set their own `max-h`/`overflow` (e.g. `manage-statuses-dialog.tsx`,
  `integration-config-card.tsx`) are unaffected — `cn()` uses
  `tailwind-merge`, so their own value wins.
- `components/workspace/workspace-shell.tsx` — the topbar's search box was a
  fixed `w-52` (208px) that crowded out the breadcrumb on narrow screens;
  it now collapses to an icon-only button below `sm:`, full box at `sm:`+.
- `components/workspace/workspace-shell.tsx` — the account menu's
  `onMouseEnter`/`onMouseLeave` handlers (on the trigger button and the
  popover content) now check
  `window.matchMedia("(hover: hover) and (pointer: fine)")` before calling
  `openProfileMenu`/`scheduleCloseProfileMenu`, via two new wrapper
  functions (`handleTriggerHoverEnter`/`handleTriggerHoverLeave`). On touch
  devices these become no-ops, so the menu is driven purely by
  `PopoverTrigger`'s click-toggle and each item's own `onClick={() =>
  setProfileOpen(false)}` — no more spurious reopen from a synthetic
  `mouseenter` landing on the trigger after a menu item's tap closes the
  popover. Desktop hover-open/close (and the explicit `openProfileMenu()`
  call used when opening the project-settings picker) are untouched.
- `components/workspace/workspace-shell.tsx` — every navigating `Link` in
  the account menu (Edit profile, Workspace settings, Project settings —
  both the single-project link and each project-picker entry, Notification
  settings, Theme) now also calls `setSidebarOpen(false)` alongside
  `setProfileOpen(false)`, matching the pattern already used by every other
  sidebar nav link, so the mobile drawer closes when navigating away
  instead of staying open over the destination page.
- `components/space/space-settings-nav.tsx` and
  `components/workspace/settings-nav.tsx` — added `overflow-y-hidden`
  alongside the existing `overflow-x-auto` on the tab-strip `nav` element,
  so setting `overflow-x` no longer implicitly upgrades `overflow-y` to
  `auto` and shows a spurious vertical scrollbar. Horizontal scroll
  behavior (the actual mobile fix) is unchanged.

## By area

- **Auth/onboarding/setup/legal** — setup wizard button rows now stack
  full-width instead of overflowing (`app/setup/setup-wizard.tsx`); added
  missing mobile padding to `onboarding/page.tsx` and `invite/[token]/page.tsx`.
- **List/Board/Calendar views** — scroll boundaries added around row stacks
  and the bulk-action bar (`list-view.tsx`); toolbar search inputs switched
  from fixed to `flex-1`/shrinkable widths (`list-view.tsx`,
  `calendar-view.tsx`); calendar day-cell chips hide the priority icon/avatar
  below `sm:` to stop them spilling into neighboring cells; container padding
  scaled down on mobile (`list-container.tsx`, `sprint/[sprintId]/page.tsx`).
  Filters/toolbar components were already responsive — no changes needed.
- **Task Detail page/drawer/comments** — the two-column body (main +
  metadata sidebar) now stacks below `lg`/`sm` in both
  `task-detail-page.tsx` and `task-detail-panel.tsx`; `FieldRow` labels stack
  above their value instead of a fixed label column; comment composer
  toolbar wraps and the emoji-mart popover is width-clamped
  (`task-activity-feed.tsx`); fixed a real flex-truncate bug (missing
  `min-w-0`) in `subtask-row.tsx` and the drawer's reporter name.
- **Overview/My Tasks/Notifications** — KPI grid gets a one-column fallback
  under ~380px (`summary-cards.tsx`); My Tasks and Notification tables/lists
  scroll horizontally instead of squeezing; **notification row actions and
  the panel's dismiss button were hover-only and unreachable on touch** —
  now visible by default on mobile, hover-gated only at `sm:`+.
- **Settings/Sprint** — settings nav tab strips scroll horizontally instead
  of overflowing (`space-settings-nav.tsx`, `components/workspace/settings-nav.tsx`);
  Danger Zone and member rows stack on mobile; sprint header/action rows wrap;
  several more hover-only actions (sprint quick-add, list-status row menu,
  archived-list unarchive) fixed the same way as Notifications above; sprint
  settings `grid-cols-2` field pairs collapse to one column on mobile.
- **Profile/Theme/Support/Search/Channel** — search palette height uses `dvh`
  so the mobile keyboard doesn't push it off-screen; avatar upload row
  stacks; support ticket bubbles get mobile-appropriate indent and
  `break-words`; touch targets bumped on composer icon buttons.
  `components/workspace/create-space-modal.tsx` switched its custom footer
  to the same stacking pattern as the shared `DialogFooter`; a couple of
  button rows in `invite-link-card.tsx`/`theme-settings-form.tsx` got a
  `flex-wrap` safety net.
- **Admin/Orbit** — the admin sidebar had *no* mobile handling at all; added
  a slide-in drawer mirroring `workspace-shell.tsx`'s established pattern
  (hamburger + backdrop + `-translate-x-full`/`lg:translate-x-0`). Hand-rolled
  tables (the legacy admin panel doesn't use the shared `Table` primitive)
  got `overflow-x-auto` wrappers; 3-column KPI grids collapse on mobile.

## Verification

- `pnpm typecheck` — clean, no errors introduced.
- `pnpm lint` — full-repo error count is pre-existing debt (~2483 baseline,
  unrelated sort-order/style rules); confirmed via `git stash` diffing that
  every touched file has the same error count before/after.
- Full diff scanned for any removed `md:`/`lg:` class — none found. The two
  places an `sm:` token's line changed both preserve the original desktop
  breakpoint unchanged (`dialog.tsx` kept `sm:max-w-md`; `summary-cards.tsx`
  kept `sm:grid-cols-4`, only the mobile-range classes below it changed).
- No visual/browser verification was possible in this environment (no
  browser automation tool available) — changes are based on reading the
  Tailwind output and doing the pixel math for the 320/360/375/390/414/768px
  target widths. Recommend a manual pass in real DevTools/devices before
  merging.
