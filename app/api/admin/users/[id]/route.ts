import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { session, user, workspace, workspaceMember } from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { purgeUser, soleOwnedWorkspaces } from "@/lib/user-deletion";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [targetUser, sessions, workspaces] = await Promise.all([
    db
      .select()
      .from(user)
      .where(eq(user.id, id))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select()
      .from(session)
      .where(eq(session.userId, id))
      .orderBy(session.createdAt),
    db
      .select({
        workspaceId: workspaceMember.workspaceId,
        role: workspaceMember.role,
        status: workspaceMember.status,
        joinedAt: workspaceMember.joinedAt,
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
      })
      .from(workspaceMember)
      .innerJoin(workspace, eq(workspaceMember.workspaceId, workspace.id))
      .where(eq(workspaceMember.userId, id)),
  ]);

  if (!targetUser) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ user: targetUser, sessions, workspaces });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // An admin can't delete their own account from the console (avoids locking
  // themselves out / removing the last admin by accident).
  if (id === adminSession.user.id) {
    return NextResponse.json(
      { error: "You can't delete your own account from the admin console." },
      { status: 400 }
    );
  }

  const targetUser = await db
    .select({ id: user.id, email: user.email, image: user.image })
    .from(user)
    .where(eq(user.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!targetUser) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Deleting a sole workspace owner would orphan that workspace — block it and
  // ask for an ownership transfer first (mirrors self-service deletion).
  const soleOwned = await soleOwnedWorkspaces(id);
  if (soleOwned.length > 0) {
    return NextResponse.json(
      {
        error:
          "This user is the sole owner of one or more workspaces. Transfer ownership to another member before deleting them.",
      },
      { status: 409 }
    );
  }

  await audit({
    action: "user_deleted",
    actorId: adminSession.user.id,
    actorEmail: adminSession.user.email,
    entityType: "user",
    entityId: id,
    description: `Admin deleted user ${targetUser.email}`,
  });

  await purgeUser(id, targetUser.image);

  return NextResponse.json({ ok: true });
}
