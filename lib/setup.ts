import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { user } from "@/db/schema";
import { db } from "@/lib/db";

/**
 * Whether the instance has been initialized — i.e. at least one user exists.
 * An empty `user` table means the first-run `/setup` wizard should take over.
 *
 * Always queries (no in-memory cache): a cheap COUNT(*), and correctness across
 * a DB restore/replacement matters more than saving a trivial query.
 */
export async function hasAnyUser(): Promise<boolean> {
  const [row] = await db.select({ c: count() }).from(user).limit(1);
  return (row?.c ?? 0) > 0;
}

/**
 * Shared entry-guard for unauthenticated pages: send the visitor to the
 * first-run wizard while the instance has no users. Reused everywhere so the
 * setup-entry logic lives in one place.
 */
export async function redirectToSetupIfNeeded(): Promise<void> {
  if (!(await hasAnyUser())) {
    redirect("/setup");
  }
}
