# Investigation — Is the theme setting workspace-level or global?

**Date:** 2026-07-24
**Item:** #12 — question, not a bug. **No behaviour was changed.** This is the written answer the item asks for; code change awaits product sign-off.

## Short answer

Theme is **workspace-level and shared by everyone in the workspace**, editable by **Owners/Admins only**. It is not per-user in any respect — not the accent colour, and not light/dark.

`docs/settings.md` describes something different, so the spec and the implementation disagree. The spec is wrong on two counts, not the code.

## Current behaviour, verified

| Question | Answer | Evidence |
|---|---|---|
| Where is it stored? | Two columns on the **workspace** row: `theme`, `appearance_mode` | `db/schema/workspace.ts:26-27` |
| Who can change it? | Owner / Admin only, twice over | `updateWorkspaceTheme` calls `requireAdmin` (`app/actions/workspace.ts:880`); `app/(app)/[workspaceId]/settings/layout.tsx:19-21` redirects non-Owner/Admin away from all of workspace settings |
| Who is affected? | Every member of that workspace | Value is read server-side per workspace and passed to `ThemeProvider` |
| Is any part per-user? | No | There is no user-scoped theme column and no per-user override |
| Across workspaces? | Independent — switching workspace switches theme | Value is on the workspace row; cookie is re-seeded per workspace |
| Is anything per-device? | Only a cache | `THEME_COOKIE` mirrors the DB value so the root layout can paint the right theme before JS runs (`theme-provider.tsx:81-93`) |

So a member who prefers dark mode cannot have it: an admin picks Dark or Light and every member of that workspace gets it.

## Where the spec disagrees

`docs/settings.md` § 2.4 (Themes) says:

1. > **Access:** All workspace members (each user's theme choice is per-workspace)

   Wrong twice. Access is Owner/Admin only, and a member has no "choice" at all — the setting is one shared value, not per-user-per-workspace. Yet the same section's "**Data written:** `workspace.theme`, `workspace.appearanceMode`" describes the actual (shared) model. The section contradicts itself.

2. > persists to `localStorage` (`kanbanica_theme_{workspaceId}` …) … On page load: localStorage is checked first; if present it overrides the DB value

   Stale. localStorage was deliberately removed — it was written only on explicit Save, drifted from the DB, and the pre-paint script trusted it, which is what caused a white flash. A cookie replaced it (`theme-provider.tsx:41-43` documents this). The doc still describes the removed mechanism.

So the reporter's instinct is right that something is off — but the mismatch is **spec vs. code**, and the direction is the opposite of the report: the report expected *more* global, while the doc promises *more per-user* than exists.

## Recommendation

**Adopt the split model (option (a) in the item), and fix the doc either way.**

| Setting | Scope | Rationale |
|---|---|---|
| **Accent theme colour** | Workspace (unchanged) | It's brand identity. A shared workspace looking the same for everyone is the point, and it already works this way. |
| **Appearance (Light/Dark/System)** | **Per user, global across workspaces** | This is an accessibility and environment preference — eyesight, ambient light, time of day. It is not a property of a team's project. An admin choosing Light for a colleague who needs Dark is a real harm, and it's the one thing users expect to follow them everywhere. Every comparable product (Linear, Notion, GitHub, ClickUp) treats appearance as per-user. |

Fully per-user (option (b)) is worse: it throws away workspace branding, which is a feature admins actually want and are already using.

### What (a) would cost

1. Migration: `user.appearance_mode` (or a `user_preference` row); keep `workspace.appearance_mode` as the fallback for users who haven't chosen.
2. `updateWorkspaceTheme` splits — accent stays admin-gated; appearance becomes a self-service per-user write with no `requireAdmin`.
3. Root layout reads appearance from the user, accent from the workspace; the theme cookie carries both.
4. `ThemeSettingsForm` (`components/workspace/theme-settings-form.tsx`) — Appearance cards become visible to all members; the accent grid stays admin-only. Today the whole page is admin-gated by the settings layout, so the Appearance section would need to live somewhere a member can reach (Profile is the natural home).
5. Rewrite `docs/settings.md` § 2.4: correct the Access line, split the scope table, and drop the localStorage paragraph.

### If product declines the split

Then only the doc changes: correct § 2.4's Access line to "Workspace Owner/Admin — the choice applies to all members of the workspace", and replace the localStorage paragraph with the cookie mechanism. That is a documentation-only fix and can ship immediately.

**Blocked pending sign-off — no code touched.**
