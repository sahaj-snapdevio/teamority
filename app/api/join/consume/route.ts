import { NextResponse } from "next/server";
import { joinViaLink } from "@/app/actions/workspace";
import { env } from "@/lib/env";
import { clearPendingJoin, readPendingJoin } from "@/lib/pending-join";

/**
 * Consumes the pending shared-invite-link cookie after authentication.
 * `/post-auth` redirects here when the cookie is present (cookie mutations
 * aren't allowed during a page render, so the clear happens here). On a
 * successful join we redirect straight into the workspace; on any failure
 * (link disabled/regenerated, workspace deleted mid-sign-in) we clear the
 * cookie and bounce back to `/post-auth` for normal routing.
 */
export async function GET() {
  const token = await readPendingJoin();
  await clearPendingJoin();

  if (token) {
    const res = await joinViaLink(token);
    if (!("error" in res)) {
      return NextResponse.redirect(new URL(`/${res.workspaceId}`, env.APP_URL));
    }
  }

  return NextResponse.redirect(new URL("/post-auth", env.APP_URL));
}
