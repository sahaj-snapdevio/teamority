import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { setPendingJoin } from "@/lib/pending-join";

/**
 * A logged-out visitor who opened `/join/[token]` is redirected here so the
 * shared-invite token can be stashed in an httpOnly cookie (only possible in a
 * route handler / server action, not during a page render). We then send them
 * to `/login`; after they authenticate via any method, `/post-auth` reads the
 * cookie and completes the join.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  await setPendingJoin(token);
  return NextResponse.redirect(new URL("/login", env.APP_URL));
}
