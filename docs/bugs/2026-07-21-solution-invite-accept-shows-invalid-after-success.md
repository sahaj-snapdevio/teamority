# Solution: "Invitation invalid" shown after the invite was actually accepted

**Date:** 2026-07-21
**Area:** Workspace invites — `app/actions/workspace.ts`, `app/(app)/invite/[token]/page.tsx`

## Fix
- `app/actions/workspace.ts` — `acceptInvite()`:
  - Stopped nulling `inviteToken` in the success `.set()` — it's already
    single-use via the `status` transition (`INVITED` → `ACTIVE`); nothing
    else in the codebase filters on `inviteToken IS NULL`, so leaving a
    stale-but-inert token doesn't reopen any hole.
  - Added an idempotent short-circuit right after the initial `SELECT`: if
    `invite.status === "ACTIVE" && invite.userId === session.user.id`,
    return `{ workspaceId }` immediately instead of erroring — this is the
    same user re-submitting an accept that already succeeded.
  - Made the transition atomic: the `UPDATE`'s `.where()` now guards
    `AND status = 'INVITED'` and uses `.returning()`, mirroring the pattern
    `activatePendingInvites` already used for its own update.
  - If that atomic update loses the race (`.returning()` empty), re-fetches
    the row by `id` and re-runs the same idempotent check before falling
    back to "This invitation has already been used".
  - Moved the "invite accepted" notification to fire only on the actual
    winning transition — the previous code sent it unconditionally, which
    also meant a lost-race caller could trigger a duplicate notification to
    the inviter.
- `app/actions/workspace.ts` — `activatePendingInvites()`: removed
  `inviteToken: null` from its `.set()` too. This is the change that fixes
  the everyday trigger — `acceptInvite`'s later `SELECT` needs to still find
  the row by token after `activatePendingInvites` already accepted it,
  which is only possible if that token is left in place. Its
  guard/`.returning()` pattern was already correct and is unchanged.
- `app/(app)/invite/[token]/page.tsx`: added a `React.useRef(false)`
  in-flight lock, checked synchronously before any `await` in both
  `handleAccept` and `handleDecline`, reset in a `finally`. Closes the
  double-click window that the `disabled` prop can't close in time on its
  own (it only takes effect after the next render commit).

Out of scope: `declineInvite` has the same `SELECT`-by-token shape, but it
`DELETE`s the row and has no competing background trigger analogous to
`activatePendingInvites` — the new client-side ref-lock covers the
realistic double-click case there. Left as a known, lower-priority
follow-up rather than widening this fix. `joinViaLink` (shared invite-link
join) was already idempotent and untouched.

## Why it works
Both writers of the `workspaceMember` row now agree on the same contract:
consuming an invite never destroys the ability to look it up again by
token, and finding an already-`ACTIVE` row that belongs to the *same*
requesting user is success, not failure. That makes `acceptInvite`
idempotent under retry, double-click, and the cross-flow race with
`activatePendingInvites` — the three ways a second call could previously
reach the same already-accepted row.
