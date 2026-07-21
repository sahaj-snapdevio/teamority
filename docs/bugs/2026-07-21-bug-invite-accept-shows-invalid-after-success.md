# Bug: "Invitation invalid" shown after the invite was actually accepted

**Date:** 2026-07-21
**Area:** Workspace invites — `app/actions/workspace.ts`, `app/(app)/invite/[token]/page.tsx`

## Symptom
An invited user clicks "Accept invitation" on `/invite/[token]`. The backend
joins them to the workspace successfully (visible in the DB / on refresh),
but the UI sometimes shows the "Invitation invalid" / "Invalid or expired
invitation" error screen instead of the success screen. Refreshing the page
(or navigating into the app) shows they're already an `ACTIVE` member.

## Where
`acceptInvite()` and `activatePendingInvites()` (`app/actions/workspace.ts`),
and the client handler in `app/(app)/invite/[token]/page.tsx`.

## Root cause
`acceptInvite` finds the invite row via `SELECT ... WHERE inviteToken =
token`, then on success sets `inviteToken: null`. Nulling the token destroys
the only lookup key — a **second** call with the same token can never find
the row again and falls into `if (!invite) return { error: "Invalid or
expired invitation" }`, even though the row is already `ACTIVE` for that
same user.

Two real triggers produce that second call:
1. **Double-click / retry** — the client's `handleAccept` had no
   re-entrancy guard, and the button's `disabled` prop only takes effect
   after the next React commit, so a fast double-click could fire
   `acceptInvite(token)` twice before the first call landed.
2. **The everyday trigger** — `app/post-auth/page.tsx` calls
   `activatePendingInvites()` on *every* sign-in (not just via the invite
   link), which auto-accepts any pending invite matching the signed-in
   user's email and *also* nulled `inviteToken`. So: a user is invited by
   email, logs into the app normally at some point unrelated to the invite
   (silently auto-joining them), then later opens the original invite email
   and clicks "Accept invitation" — the token is already null, producing the
   same false error despite already being a member.

Neither writer treated "this exact user already accepted this exact invite"
as anything other than "token not found." The codebase already had the
correct idiom for this elsewhere in the same file — `joinViaLink`'s
"already an active member → idempotent success" check, and
`activatePendingInvites`'s guarded atomic `UPDATE ... WHERE status =
'INVITED' RETURNING ...` — but `acceptInvite` itself never used them.
