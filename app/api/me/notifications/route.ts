import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  or,
  type SQL,
} from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { notification, user, workspace } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EVENT_TRIGGERS } from "@/lib/notifications/filters";

export async function DELETE(req: NextRequest) {
  void req;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await db
    .delete(notification)
    .where(eq(notification.recipientId, session.user.id))
    .returning({ id: notification.id });

  return NextResponse.json({ ok: true, count: deleted.length });
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = req.nextUrl;
  const filter = searchParams.get("filter") ?? "all";
  const cursor = searchParams.get("cursor");
  // Advanced filters — all optional and combined with AND.
  const search = searchParams.get("q")?.trim();
  const workspaceFilter = searchParams.get("workspace");
  const event = searchParams.get("event");
  const after = searchParams.get("after");
  const before = searchParams.get("before");

  const conditions: SQL[] = [eq(notification.recipientId, userId)];

  if (filter === "unread") {
    conditions.push(eq(notification.isRead, false));
  } else if (filter === "mentions") {
    conditions.push(
      inArray(notification.triggerType, [
        "mention_comment",
        "mention_description",
      ])
    );
  }

  if (workspaceFilter) {
    conditions.push(eq(notification.workspaceId, workspaceFilter));
  }

  if (event) {
    const triggers = EVENT_TRIGGERS[event];
    if (triggers?.length) {
      conditions.push(inArray(notification.triggerType, triggers));
    }
  }

  // Date range (bounds are computed client-side in the viewer's timezone and
  // sent as ISO instants, so they stay consistent with the client grouping).
  if (after) {
    conditions.push(gte(notification.createdAt, new Date(after)));
  }
  if (before) {
    conditions.push(lt(notification.createdAt, new Date(before)));
  }

  // Free-text search across the message, actor name and workspace name (the
  // task title is already embedded in the notification title).
  if (search) {
    const like = `%${search}%`;
    const matches = or(
      ilike(notification.title, like),
      ilike(notification.body, like),
      ilike(user.name, like),
      ilike(workspace.name, like)
    );
    if (matches) {
      conditions.push(matches);
    }
  }

  if (cursor) {
    conditions.push(lt(notification.createdAt, new Date(cursor)));
  }

  const [notifications, unreadCountResult] = await Promise.all([
    db
      .select({
        id: notification.id,
        workspaceId: notification.workspaceId,
        actorId: notification.actorId,
        triggerType: notification.triggerType,
        entityType: notification.entityType,
        entityId: notification.entityId,
        title: notification.title,
        body: notification.body,
        isRead: notification.isRead,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
        actorName: user.name,
        actorImage: user.image,
        workspaceName: workspace.name,
        workspaceIcon: workspace.logoEmoji,
      })
      .from(notification)
      .leftJoin(user, eq(user.id, notification.actorId))
      .leftJoin(workspace, eq(workspace.id, notification.workspaceId))
      .where(and(...conditions))
      .orderBy(desc(notification.createdAt))
      .limit(20),
    db
      .select({ count: count() })
      .from(notification)
      .where(
        and(
          eq(notification.recipientId, userId),
          eq(notification.isRead, false)
        )
      ),
  ]);

  const unreadCount = unreadCountResult[0]?.count ?? 0;

  return NextResponse.json({ notifications, unreadCount });
}
