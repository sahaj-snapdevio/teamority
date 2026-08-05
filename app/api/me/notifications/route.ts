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
import {
  EVENT_TRIGGERS,
  NOTIFICATIONS_PAGE_SIZE,
} from "@/lib/notifications/filters";

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
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  // Advanced filters — all optional and combined with AND.
  const search = searchParams.get("q")?.trim();
  const workspaceFilter = searchParams.get("workspace");
  const actorFilter = searchParams.get("actor");
  const event = searchParams.get("event");
  const after = searchParams.get("after");
  const before = searchParams.get("before");

  // `scopeConditions` = everything the user narrowed the Inbox down to
  // (workspace / actor / event / date / search), WITHOUT the All·Unread·Mentions
  // tab. The tabs replace each other, so the unread count means "how many
  // unread you'd see if you switched to the Unread tab with these same
  // filters" — which is what the header badge and the Unread tab badge both
  // show.
  const scopeConditions: SQL[] = [eq(notification.recipientId, userId)];

  if (workspaceFilter) {
    scopeConditions.push(eq(notification.workspaceId, workspaceFilter));
  }

  if (actorFilter) {
    scopeConditions.push(eq(notification.actorId, actorFilter));
  }

  if (event) {
    const triggers = EVENT_TRIGGERS[event];
    if (triggers?.length) {
      scopeConditions.push(inArray(notification.triggerType, triggers));
    }
  }

  // Date range (bounds are computed client-side in the viewer's timezone and
  // sent as ISO instants, so they stay consistent with the client grouping).
  if (after) {
    scopeConditions.push(gte(notification.createdAt, new Date(after)));
  }
  if (before) {
    scopeConditions.push(lt(notification.createdAt, new Date(before)));
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
      scopeConditions.push(matches);
    }
  }

  // The tab narrows the LIST on top of the scope above; it deliberately does
  // not narrow the unread count.
  const conditions: SQL[] = [...scopeConditions];
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

  const [notifications, unreadCountResult, totalCountResult] =
    await Promise.all([
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
        .limit(NOTIFICATIONS_PAGE_SIZE)
        .offset((page - 1) * NOTIFICATIONS_PAGE_SIZE),
      // Unread count for the ACTIVE filter scope — the same joins as the list
      // query, since the free-text search reaches into `user` / `workspace`.
      db
        .select({ count: count() })
        .from(notification)
        .leftJoin(user, eq(user.id, notification.actorId))
        .leftJoin(workspace, eq(workspace.id, notification.workspaceId))
        .where(and(...scopeConditions, eq(notification.isRead, false))),
      db
        .select({ count: count() })
        .from(notification)
        .leftJoin(user, eq(user.id, notification.actorId))
        .leftJoin(workspace, eq(workspace.id, notification.workspaceId))
        .where(and(...conditions)),
    ]);

  const unreadCount = unreadCountResult[0]?.count ?? 0;
  const totalCount = totalCountResult[0]?.count ?? 0;

  return NextResponse.json({ notifications, unreadCount, totalCount, page });
}
