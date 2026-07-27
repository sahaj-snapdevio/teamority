# Google OAuth Setup

## Overview

**What it is:** "Sign in with Google" — lets users authenticate without a password or a magic-link email.

**Why Kanbanica uses it:** it's one of three interchangeable login methods (alongside magic-link email and email+password), handled by [Better Auth](https://better-auth.com) (`lib/auth.ts`). All three produce the same session and the same `user` row — one account per email, however someone signs in.

**Required or optional:** **optional**, but it counts toward the "at least one login method" requirement Kanbanica enforces in production. If you don't configure SMTP or `ALLOW_PASSWORD_SIGNUP=true` either, you must configure this.

---

## Step-by-step setup

### 1. Create (or reuse) a Google Cloud project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Top bar → project dropdown → **New Project**. Give it any name (e.g. "Kanbanica"). You can reuse an existing project instead.

### 2. Configure the OAuth consent screen

1. In the left sidebar: **APIs & Services → OAuth consent screen**.
2. Choose **User Type**:
   - **External** — for almost everyone (any Google account can sign in). This is what you want for a self-hosted instance used by your team or the public.
   - **Internal** — only if you're on Google Workspace and want to restrict logins to your organization's domain.
3. Fill in the required fields: **App name** (shown on the consent screen users see), **User support email**, **Developer contact email**.
4. **Scopes** — click **Add or Remove Scopes** and add `.../auth/userinfo.email` and `.../auth/userinfo.profile` (or just `email` and `profile`). Kanbanica only needs the user's email and basic profile — nothing else.
5. Save through the remaining steps (Test users only matters if the app stays in "Testing" status — see Common Mistakes below).

### 3. Create OAuth credentials

1. **APIs & Services → Credentials → + Create Credentials → OAuth client ID**.
2. **Application type:** Web application.
3. **Name:** anything (e.g. "Kanbanica production").
4. **Authorized redirect URIs** — this is the field people get wrong (see Common Mistakes). Add exactly:

   ```
   {APP_URL}/api/auth/callback/google
   ```

   Substitute your actual `APP_URL` from `.env`. Examples:

   ```
   http://localhost:3000/api/auth/callback/google        # local dev
   https://tasks.yourcompany.com/api/auth/callback/google # production
   ```

   This path is fixed by Better Auth (`app/api/auth/[...all]/route.ts` handles it) — you cannot change it on the Kanbanica side, only match it exactly in Google's console.

5. Click **Create**. Google shows you a **Client ID** and **Client secret** — copy both immediately (the secret is shown once, though you can always view/regenerate it later from the Credentials page).

### 4. Set the environment variables

In `.env`:

```bash
GOOGLE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
```

Restart the app (`pnpm dev`, or redeploy in production). No other configuration is needed — Kanbanica detects both variables are set and enables the Google button automatically (`lib/auth-config.ts` → `getAuthMethods()`).

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Only if you want Google login | From the OAuth client you created above |
| `GOOGLE_CLIENT_SECRET` | Only if you want Google login | Keep this secret — treat it like a password |

Both must be set together — Kanbanica only enables Google login when both are present (`lib/auth.ts`).

---

## Verification

1. Restart the app after setting the env vars.
2. Go to `/login` — a **"Continue with Google"** button should now appear (it's hidden entirely when the variables are unset, so no broken button is ever shown).
3. Click it, choose a Google account, and approve.
4. You should land back in the app, signed in. A new `user` row is created on first login; a returning user with a matching verified email is signed into their existing account.

If the button doesn't appear, the env vars aren't both set — check for typos and restart the process (they're read once at boot, not live-reloaded).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `redirect_uri_mismatch` error from Google | The **Authorized redirect URI** in Google's console doesn't exactly match `{APP_URL}/api/auth/callback/google`. Check for a trailing slash, `http` vs `https`, or a stale `APP_URL` from before you changed domains. |
| Google shows "This app isn't verified" | Normal while your OAuth consent screen is in **Testing** status — only the test users you explicitly added can sign in. Either add testers under **OAuth consent screen → Test users**, or submit the app for verification if you're opening it to the public (unverified apps cap at 100 test users and show a warning screen). |
| "Continue with Google" doesn't appear on `/login` | `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is missing/empty, or the process wasn't restarted after editing `.env`. |
| "Account not linked" error after clicking Google, for a user who already has a password account on that email | Better Auth only auto-links a Google login to an existing password account if that account's email is **verified**. If SMTP isn't configured, password accounts are never verified, so this link can't happen automatically — see [`docs/authentication.md`](../authentication.md). |
| Works locally but not in production | Production needs its **own** redirect URI registered for its real `APP_URL` — `localhost` and your production domain are two separate entries in Google's console; add both if you test locally against the same OAuth client. |

---

See also: [`docs/authentication.md`](../authentication.md) for how Google login interacts with magic-link and password accounts.
