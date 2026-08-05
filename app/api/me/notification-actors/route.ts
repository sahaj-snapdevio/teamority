import { and, asc, eq, isNotNull } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { notification, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Distinct actors (users) who triggered a notification the current user
// received — powers the Inbox "User" filter dropdown. Scoped to notifications
// the user received, so the dropdown only lists people who can actually
// appear in the Inbox. System-generated notifications have no actor and are
// excluded.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actors = await db
    .selectDistinct({
      id: user.id,
      name: user.name,
      image: user.image,
    })
    .from(notification)
    .innerJoin(user, eq(user.id, notification.actorId))
    .where(
      and(
        eq(notification.recipientId, session.user.id),
        isNotNull(notification.actorId)
      )
    )
    .orderBy(asc(user.name));

  return NextResponse.json({ actors });
}
