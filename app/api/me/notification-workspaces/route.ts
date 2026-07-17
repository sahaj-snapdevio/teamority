import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { notification, workspace } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Distinct workspaces the current user has notifications from — powers the
// Inbox "Workspace" filter dropdown. Scoped to notifications the user received,
// so the dropdown only lists workspaces that can actually appear in the Inbox.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await db
    .selectDistinct({
      id: workspace.id,
      name: workspace.name,
      icon: workspace.logoEmoji,
    })
    .from(notification)
    .innerJoin(workspace, eq(workspace.id, notification.workspaceId))
    .where(eq(notification.recipientId, session.user.id))
    .orderBy(asc(workspace.name));

  return NextResponse.json({ workspaces });
}
