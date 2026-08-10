import { NextResponse } from "next/server";
import { joinViaLink } from "@/app/actions/workspace";
import { env } from "@/lib/env";
import { clearPendingJoin, readPendingJoin } from "@/lib/pending-join";

/**
 * Consumes the pending shared-invite-link cookie after authentication (in a
 * route handler since cookie mutations aren't allowed during page render).
 * Redirects into the workspace on success; on failure clears the cookie and
 * bounces back to `/post-auth`.
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
