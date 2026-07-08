import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { ADMIN_ROLE } from "@/config/platform";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Returns the session if the user is a platform admin, otherwise returns null.
// Re-reads role + banned from the DB (not the cached session) so a demoted or
// banned admin loses access immediately, matching requireAdmin() in lib/authz.ts.
export async function getAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const [fresh] = await db
    .select({ role: user.role, banned: user.banned })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!fresh || fresh.banned || fresh.role !== ADMIN_ROLE) return null;
  return session;
}
