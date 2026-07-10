import { and, eq, isNotNull } from "drizzle-orm";
import { account } from "@/db/schema";
import { db } from "@/lib/db";

/** The providerId Better Auth uses for email + password credentials. */
export const CREDENTIAL_PROVIDER = "credential";

/**
 * True when this user can sign in with a password.
 *
 * Deliberately NOT a server action — it must not be reachable from the client
 * with an arbitrary `userId`, since that would reveal which accounts have
 * passwords set.
 */
export async function userHasPassword(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, CREDENTIAL_PROVIDER),
        isNotNull(account.password)
      )
    )
    .limit(1);
  return !!row;
}
