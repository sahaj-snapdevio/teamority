# Authentication

## Overview

Authentication handles user identity — who you are, how you prove it, and how your session is maintained across devices. Kanbanica uses **Better Auth** with the **Admin Plugin** as the authentication library, integrated directly into Next.js.

**Powered by:** [Better Auth](https://better-auth.com)

**Auth methods.** All three produce the same `session` row — there is only one session system, and one `user` row per email address.

| Method | Requires | Enabled |
|--------|----------|---------|
| Magic Link (passwordless) | SMTP in production (console-logged in dev) | Always |
| Google OAuth | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | When both are set |
| Email + Password | nothing | Sign-in always; **sign-up** only when `ALLOW_PASSWORD_SIGNUP=true` |

- Magic link: user enters their email -> receives a one-time sign-in link -> clicks it -> session created. First-time use automatically creates an account.
- Email + password: see [§ 1a](#1a-email--password) below. Registration is an explicit opt-in so an instance stays invite-only by default.

**Why Better Auth:**
- Built specifically for Next.js (API Routes + Server Actions)
- Database-backed sessions (more secure than stateless JWT)
- Admin Plugin gives user ban, impersonation, and session revoke out of the box
- Works natively with Drizzle ORM + PostgreSQL

---

## Auth Flows

| Flow | Description |
|------|-------------|
| Sign In / Sign Up | User enters email -> receives magic link -> clicks link -> session created (account auto-created on first use) |
| Email Verification | Email is considered verified on first successful magic link use |
| Sign Out | End the current session |
| Session Management | View and revoke active sessions across devices |

---

## 1. Sign In / Sign Up (Magic Link)

### Flow

1. User visits `/sign-in`
2. Enters their email address
3. Clicks `"Send Sign-In Link"`
4. Always shows: `"If this email is valid, a sign-in link has been sent."` — same message regardless of whether the email exists (prevents account enumeration)
5. Better Auth sends a magic link email via SMTP
6. User clicks the link -> `GET /api/auth/magic-link/verify?token=:token`
7. Better Auth validates the token:
   - **New user** (email not in DB): account is auto-created, user is redirected to `/onboarding`
   - **Existing user**: session is created, user is redirected to the app (last active workspace or workspace switcher)
8. On expired/invalid token: `"This link has expired or has already been used. Request a new one."` with a button to go back to `/sign-in`

### Magic link rules

- Link is valid for **15 minutes**
- Link is **single-use** — invalidated immediately after the session is created
- If the user requests another link before the first expires, the old link is invalidated
- Rate limited: max **5 magic link requests** per email per 15 minutes (Better Auth built-in)

### Account auto-creation on first use

When a magic link is used and no account exists for that email:
- A `User` record is created with the provided email
- `email_verified` is set to `true` (magic link itself proves email ownership)
- User is redirected to `/onboarding` to complete workspace setup

### Validation

| Field | Rules |
|-------|-------|
| Email | Required, valid email format |

---

## 1a. Email + Password

Uses Better Auth's built-in `emailAndPassword` — no custom password code, no extra client plugin, and **no database migration** (`account.password`, `user.email_verified` and the `verification` table already exist).

### Configuration

| Env | Effect |
|-----|--------|
| `ALLOW_PASSWORD_SIGNUP=false` (default) | Password **sign-in** works; `/signup` returns 404 and `/login` shows no password field. Instance stays invite-only. |
| `ALLOW_PASSWORD_SIGNUP=true` | `/signup` and the password field on `/login` appear. |

`ALLOW_PASSWORD_SIGNUP=true` also satisfies the production start-up check in `lib/env.ts` on its own — a self-hosted instance needs neither SMTP nor Google.

Password rules: **8–128 characters**, enforced server-side (`minPasswordLength` / `maxPasswordLength`). Hashing is Better Auth's scrypt.

### Email verification

`requireEmailVerification` is **on exactly when SMTP is configured**. This is not cosmetic:

- Magic-link and Google sign-ups land with `email_verified = true`.
- `/sign-up/email` lands with `email_verified = false`.
- Better Auth refuses to implicitly link an OAuth account onto an **unverified** local user (`accountLinking.requireLocalEmailVerified`, default `true`).

So an unverified password account cannot later use "Continue with Google" — it fails with `account_not_linked`. Requiring verification (when we can actually send the mail) is what keeps all three methods converging on a single account. **Do not** set `requireLocalEmailVerified: false` to work around this: it would let an attacker pre-register a password account on someone's address and have that person's Google sign-in link straight into it.

Without SMTP the trade-off is accepted deliberately: sign-up works, the user stays unverified, and Google linking is unavailable (Google is usually not configured on such a deployment either).

### Password reset

`/forgot-password` → `authClient.requestPasswordReset()` → `sendResetPassword` → `/reset-password?token=…`.

- The reset link expires in 1 hour and is single-use.
- `revokeSessionsOnPasswordReset: true` — completing a reset signs out **every** device.
- The flow **requires SMTP**: `sendEmailViaSmtp` only console-logs when unconfigured, so `/forgot-password` returns 404 and the "Forgot password?" link is hidden in that case.
- `/forgot-password` always reports success, whether or not the address exists.

### Setting or changing a password

The profile page shows a **Set a Password** card to users who have none (magic-link / Google sign-ups), and **Change Password** to those who do.

- Set: `setPasswordAction` (`app/actions/auth.ts`) — Better Auth's `setPassword` is a **server-only** endpoint, so it cannot be called from `authClient`. The action refuses if a password already exists.
- Change: `authClient.changePassword({ revokeOtherSessions: true })` — requires the current password, keeps the current session, signs out other devices.

### Rate limits (`lib/auth.ts`)

| Endpoint | Limit |
|----------|-------|
| `/sign-in/magic-link` | 5 / 60s |
| `/sign-in/email` | 10 / 60s |
| `/sign-up/email` | 5 / 60s |
| `/request-password-reset` | 3 / 60s |
| `/reset-password` | 5 / 60s |

Both this limiter and `lib/rate-limit.ts` are **in-memory**, so they are per-process. A multi-instance deployment needs a shared store.

### Known limitations

- `/sign-up/email` returns `USER_ALREADY_EXISTS`, which confirms an email is registered. The signup UI collapses that into the neutral "check your inbox" screen **when verification is on**; without SMTP the difference is observable.
- With sign-up enabled, an address can be registered before its real owner ever signs in. If that owner later uses a magic link, Better Auth signs them into the existing row and marks it verified — leaving the squatter's password valid. Mitigations: sign-up defaults to off, verification is required when SMTP exists, and onboarding is invite-based.

### Validation

| Field | Rules |
|-------|-------|
| Name | Required, 1–100 characters |
| Email | Required, valid email format |
| Password | Required, 8–128 characters |
| Confirm password | Must match |

---

## 2. Sign Out

### Single device sign out

- Click avatar -> `"Sign Out"`
- Current session is destroyed
- User is redirected to `/sign-in`

### Sign out all devices

- Available from `/[workspaceId]/profile`
- Revokes all active sessions across all devices
- User is signed out of the current device too
- Useful after a suspected account compromise

---

## 3. Session Management

Users can view and manage all active sessions on their account.

### Access

- `/[workspaceId]/profile`

### Session list

Each active session shows:
- Device type (Desktop / Mobile — inferred from user agent)
- Browser (Chrome, Firefox, Safari, etc.)
- Approximate location (city, country — from IP, best-effort)
- Last active timestamp
- `"Current session"` badge on the active one

### Actions

| Action | Description |
|--------|-------------|
| Revoke session | End a specific session (log out that device) |
| Revoke all other sessions | End all sessions except the current one |

### Session rules

- Database-backed sessions (stored in `Session` table via Better Auth)
- Default TTL: **7 days** (no "remember me" needed — magic link is already low friction)
- Sessions use sliding expiry — TTL resets on each authenticated request
- A banned user's sessions are all revoked immediately by Better Auth Admin Plugin

---

## 4. Account Settings

Available at `/[workspaceId]/profile` (workspace-scoped route; profile, password, and session management are all on this one page — see `app/(app)/[workspaceId]/profile/page.tsx`).

### Profile

- Update Full Name
- Update Avatar:
  - Upload a photo (JPEG, PNG, WebP, or GIF — max 2MB raw upload, resized server-side to 256×256)
  - If no photo is uploaded: initials fallback is shown automatically (see [avatar-system.md](./avatar-system.md) for exactly how initials are derived and its "Implementation status" note on what's actually shipped)
- Email address (read-only — cannot be changed in MVP)

### Danger Zone

- Delete Account
  - Permanently deletes the user's account and all personal data
  - Requires typing email address to confirm
  - **If the user is the Owner of a workspace with other members:**
    - Must transfer ownership first — account deletion is blocked
    - Shown: `"You are the Owner of [Workspace Name]. Transfer ownership to another member before deleting your account."`
    - One prompt per workspace if they own multiple
  - **If the user is the Owner and the sole member of a workspace:**
    - No other member to transfer to — workspace is automatically deleted along with the account
    - Shown: `"Deleting your account will also permanently delete [Workspace Name] and all its data. This cannot be undone."`
    - User must confirm this explicitly before proceeding
    - The cascade deletion follows the same rules as a manual workspace deletion
  - **If the user is not an owner of any workspace:**
    - Account is deleted immediately
    - Their task assignments, comments, and activity log entries are attributed to `"Deleted User"`

---

## 5. Better Auth — Admin Plugin Features

The Better Auth Admin Plugin gives platform admins additional capabilities managed via the Admin Panel:

| Feature | Description |
|---------|-------------|
| Ban user | Immediately revokes all sessions. User cannot sign in. |
| Unban user | Restores sign-in access. |
| Impersonate user | Platform admin can log in as any user for support. Opens a separate session. |
| Revoke sessions | Revoke any user's sessions individually or all at once. |
| List sessions | View all active sessions for any user. |

These are accessed via the Admin Panel — not exposed to customers.

---

## Onboarding Flow (post-auth)

After a new user successfully authenticates for the first time, they go through a guided onboarding:

```
Step 1: Create Workspace
  L-- Enter workspace name + upload logo (optional)

Step 2: Create first Space
  L-- Enter Space name + pick color
  L-- Default List named "List" is auto-created inside the Space

Step 3: Done -> land inside the first List
  L-- Getting Started checklist is shown pinned above the empty task list
  L-- Checklist guides: create task -> invite teammate -> set due date -> try Board view
```

Returning users skip onboarding and go directly to their last active workspace.

**Empty states after onboarding:** Every screen the user can land on with no data has a defined empty state with a clear message and CTA. See [empty-states.md](./empty-states.md) for the full spec of all empty states including the Getting Started checklist.

---

## Data Model

Better Auth manages most of the auth-related tables. The core tables it creates:

```
User
+-- id                  (uuid, primary key)
+-- name                (string)
+-- email               (string, unique)
+-- email_verified      (boolean, default: false — set to true on first magic link use)
+-- image               (string — avatar URL, nullable)
+-- is_platform_admin   (boolean, default: false)  <- custom field added by us
+-- banned              (boolean, default: false)   <- managed by Admin Plugin
+-- banned_reason       (string, nullable)          <- managed by Admin Plugin
+-- created_at          (timestamp)
L-- updated_at          (timestamp)

Session
+-- id                  (uuid, primary key)
+-- user_id             (foreign key -> User)
+-- token               (string, unique — hashed session token)
+-- expires_at          (timestamp)
+-- ip_address          (string, nullable)
+-- user_agent          (string, nullable)
+-- impersonated_by     (uuid, nullable)            <- set during admin impersonation
+-- created_at          (timestamp)
L-- updated_at          (timestamp)

Account
+-- id                  (uuid, primary key)
+-- user_id             (foreign key -> User)
+-- provider            (string — "magic-link")
+-- provider_account_id (string — the user's email)
+-- created_at          (timestamp)
L-- updated_at          (timestamp)

Verification
+-- id                  (uuid, primary key)
+-- identifier          (string — email address)
+-- value               (string — hashed magic link token)
+-- expires_at          (timestamp — 15 minutes from creation)
L-- created_at          (timestamp)
```

---

## API Endpoints

Better Auth exposes a unified handler at `/api/auth/[...all]` in Next.js. These are the key routes it handles:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/magic-link/send` | Request a magic link for an email address |
| GET | `/api/auth/magic-link/verify?token=` | Verify magic link token, create session |
| POST | `/api/auth/sign-in/email` | Sign in with email + password |
| POST | `/api/auth/sign-up/email` | Register with email + password (only when `ALLOW_PASSWORD_SIGNUP=true`) |
| POST | `/api/auth/request-password-reset` | Send a password reset link (requires SMTP) |
| POST | `/api/auth/reset-password` | Consume a reset token and set a new password |
| POST | `/api/auth/change-password` | Change a known password (requires the current one) |
| POST | `/api/auth/set-password` | Set a first password — **server-only**, called via `setPasswordAction` |
| GET | `/api/auth/verify-email?token=` | Confirm an email address (sign-up + email change) |
| POST | `/api/auth/sign-out` | Sign out current session |
| GET | `/api/auth/get-session` | Get current session + user |
| GET | `/api/auth/list-sessions` | List all active sessions for current user |
| POST | `/api/auth/revoke-session` | Revoke a specific session |
| POST | `/api/auth/revoke-other-sessions` | Revoke all sessions except current |

---

## UI Screens

| Screen | Route | Access |
|--------|-------|--------|
| Sign In | `/sign-in` | Unauthenticated — includes one-line explainer: *"We'll email you a secure link — no password needed."* |
| Magic Link Sent | `/sign-in?sent=true` | Unauthenticated (shown after requesting link) |
| Magic Link Verify | `/api/auth/magic-link/verify?token=` | Unauthenticated (handled by Better Auth) |
| Sign Up | `/signup` | Unauthenticated — **404 unless `ALLOW_PASSWORD_SIGNUP=true`** |
| Forgot Password | `/forgot-password` | Unauthenticated — **404 unless SMTP is configured** |
| Reset Password | `/reset-password?token=` | Unauthenticated — renders an "expired link" state on `?error=` |
| Onboarding | `/onboarding` | Authenticated (new user only) |
| Account Settings | `/[workspaceId]/profile` | Authenticated |
| Session Management | `/[workspaceId]/profile` (same page) | Authenticated |

Each auth screen renders only the providers this deployment actually has — `getAuthMethods()` (`lib/auth-config.ts`) is read server-side and passed down, so a self-host without Google never shows a Google button that can only fail. OAuth callback failures redirect to `/login?error=…` (`onAPIError.errorURL`) and are rendered through `authErrorMessage()` (`lib/auth-errors.ts`).

### Magic Link Sent Screen — UI Spec

Shown immediately after the user clicks "Send Sign-In Link". Reduces abandonment during the email delivery wait.

```
+-----------------------------------------+
|                                         |
|            (email)  Check your email          |
|                                         |
|   We sent a sign-in link to             |
|   jane@example.com                      |
|                                         |
|   (~)  Waiting for you to click the link  |  <- animated spinner
|   This usually takes under 30 seconds.  |
|                                         |
|   ------------------------------------  |
|                                         |
|   Didn't get it?  [Resend email]        |
|   Wrong email?    [Go back]             |
|                                         |
L-----------------------------------------+
```

| Element | Detail |
|---------|--------|
| Headline | `"Check your email"` |
| Subtext | `"We sent a sign-in link to [email]"` — shows the exact email submitted |
| Animated indicator | Spinner or pulsing dot next to `"Waiting for you to click the link"` |
| Reassurance copy | `"This usually takes under 30 seconds."` |
| Resend CTA | `"Resend email"` — triggers a new magic link request; disabled for 60s after each send to prevent spam; shows countdown: `"Resend in 45s"` |
| Go back link | `"Wrong email? Go back"` — returns to `/sign-in` with the email field pre-filled |

**Resend throttle:** The Resend button is disabled for 60 seconds after each send (client-side countdown). This is separate from the server-side rate limit of 5 requests per 15 minutes — if the server rate limit is hit, show: `"Too many attempts. Please wait a few minutes before trying again."`

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Magic link abuse | Rate limit: 5 requests per 15 min per email (Better Auth built-in) |
| Email enumeration | Magic link request always shows the same response message |
| Session hijacking | Database-backed sessions; token hashed in DB |
| CSRF | Better Auth handles CSRF protection on all POST routes |
| Token reuse | Magic link tokens are single-use, invalidated immediately on use |
| Token expiry | Magic links expire in 15 minutes |
| Banned users | Sessions revoked immediately on ban; cannot request new magic link |
| Impersonation | Logged in `PlatformAuditLog`; impersonated session marked with `impersonated_by` |
| Account deletion | Requires email confirmation; workspace ownership must be transferred first |

---

## Data Lifecycle

### Archive
- User accounts cannot be archived — they are either active, banned, or deleted.
- **Banned** users are the functional equivalent of a suspended state — account exists but cannot authenticate.

### Soft Delete — User Account
- User account deletion is a **hard delete** — no soft delete or tombstone on the User record.
- Before deletion is allowed, all ownership dependencies must be resolved (transfer workspace ownership).
- There is **no grace period** or recovery after deletion is confirmed.

### Token Lifecycle

| Token type | Expiry | Single-use | On expiry |
|------------|--------|-----------|-----------|
| Magic link | 15 minutes | Yes — invalidated on use | Link shows "expired" error; user requests a new one from `/sign-in` |
| Session token | 7 days (sliding) | No — TTL resets on each request | Session is invalidated; user redirected to sign-in |

### Session Lifecycle
- Sessions use **sliding expiry** — TTL resets on every authenticated request.
- Sessions are hard-deleted from the `Session` table when:
  - User signs out (single session).
  - User revokes a session from settings.
  - User clicks "Sign out all devices".
  - User is banned (all sessions revoked immediately by Admin Plugin).
  - Session TTL expires without activity.

### Recovery Period
- **Banned user:** Recoverable — Admin can unban at any time. All user data is preserved during ban.
- **Deleted user account:** No recovery. Hard delete is permanent and immediate.
- **Expired magic link:** No recovery — user requests a new link from `/sign-in`.
- **Expired session:** No recovery — user requests a new magic link to sign in again.

### Permanent Deletion Rules
- On user account deletion, the following are permanently removed:
  - `User` record
  - All `Session` records for the user
  - All `Account` records
  - All `Verification` records for the user
  - All `WorkspaceMember` records (user removed from all workspaces)
  - All `SpaceMember` records
  - All `UserNotificationPreference`, `UserEmailPreference`, `MutedEntity` records
  - All `PushSubscription` records
  - All `SavedFilter`, `UserListViewPreference`, `UserSearchHistory`, `UserMyTasksPreference` records
  - All `Notification` records where the user is the recipient
- **Tasks and Comments are NOT deleted** — they remain with their content intact, but:
  - Assignee references are set to `null` (unassigned)
  - Reporter reference is kept as the user ID (orphaned reference, shown as "Deleted User" in UI)
  - Comment `author_id` is kept (orphaned — shown as "Deleted User" in UI)
- If the user was the **sole Owner** of a Workspace with other members, deletion is blocked until ownership is transferred.
- If the user was the **sole Owner and sole member** of a Workspace, the workspace is auto-deleted along with the account after explicit confirmation.

---

## Business Rules

1. Email addresses are unique across the platform — one account per email.
2. Magic link is always available; Email + Password and Google OAuth are additional, independently-configurable methods (see the provider table above) — all three converge on the same `session`/`user` rows.
3. First magic link use for an unknown email auto-creates the account — sign up and sign in are the same flow.
4. Magic link tokens are single-use and expire in 15 minutes — a used or expired link cannot be re-used.
5. If a new magic link is requested while a previous one is still valid, the old token is invalidated.
6. A banned user's sessions are revoked immediately — they cannot request a new magic link until unbanned.
7. Magic link requests always return the same response message regardless of whether the email is registered — prevents account enumeration.
8. A user cannot delete their account if they are the sole Owner of a workspace with other members — ownership must be transferred first.
9. Sessions use sliding expiry — TTL is reset on each authenticated request, keeping active users logged in.
10. Magic link requests are rate-limited to 5 per email per 15 minutes to prevent abuse.

---

## Implementation Notes

### Auth pattern — API routes and server actions

Every API route handler and server action calls `auth.api.getSession({ headers: await headers() })` as its first line and returns/responds `Unauthorized` immediately if there's no session — there's no separate shared wrapper for this, it's inlined the same way at the top of each handler. Example (`app/api/me/notifications/[id]/read/route.ts`):

```typescript
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // permission check, then business logic
}
```

Server actions follow the same order but return `{ error: string }` instead of a `NextResponse` (`app/actions/task.ts`'s `createTask`):

```typescript
export async function createTask(workspaceId: string, spaceId: string, listId: string | null, data: { /* ... */ }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const err = await requireEditAccess(session.user.id, workspaceId, spaceId);
  if (err) return err;

  // business logic
}
```

Rules:
- Session missing -> `401 Unauthorized` (routes) / `{ error: "Unauthorized" }` (actions)
- Permission check is always the second step, right after the session check
- Never expose internal error messages -- always a generic `{ error: string }`

### Permission helpers (`lib/permissions.ts`)

The two-level permission check (workspace role + space permission) lives in `lib/permissions.ts`, not inlined per-action:

- `hasPermissionLevel(permission, minLevel)` — compares `"view" | "edit" | "full_access"` against a minimum.
- `getSpacePermission(userId, workspaceId, spaceId)` — returns the user's effective level (`"full_access"` for workspace Owner/Admin regardless of `SpaceMember`, otherwise looks up the `SpaceMember` row), or `null` if they have no access.
- `requireSpacePermission(userId, workspaceId, spaceId, minLevel)` — returns `{ error, status }` (404 for a private space with no access, to avoid leaking existence; 403 otherwise) or `null` if access is granted. Convenience wrappers like `requireEditAccess` build on this for a specific level.

See [permission-model.md](./permission-model.md) for the full permission matrix.

---

## Out of Scope (MVP)

- Additional OAuth providers beyond Google (e.g. GitHub) — can be added post-MVP if there is user demand
- Two-factor authentication (2FA)
- SSO / SAML
- Account email change
