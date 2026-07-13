import { cookies } from "next/headers";

/**
 * A logged-out visitor who opens a shared invite link (`/join/[token]`) has the
 * token stashed in this httpOnly cookie, then is sent to `/login`. After they
 * authenticate — via any method — `/post-auth` reads the cookie and completes
 * the join. `sameSite: "lax"` is required so the cookie survives the Google
 * OAuth redirect round-trip.
 */
const COOKIE_NAME = "pending_join_token";
const MAX_AGE_SECONDS = 60 * 60; // 1 hour — plenty to complete sign-in

export async function setPendingJoin(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readPendingJoin(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function clearPendingJoin(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
