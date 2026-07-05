import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { workspace, workspaceMember } from "@/db/schema";
import { db } from "@/lib/db";
import { getAccessibleSpaceIds } from "@/lib/permissions";
import { list } from "@/db/schema";

export default async function PostAuthPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // Platform admins are normal users with extra capabilities — they land in the
  // regular app (their workspaces), and reach the Admin Console via the sidebar.

  const [membership] = await db
    .select({
      workspaceId: workspaceMember.workspaceId,
    })
    .from(workspaceMember)
    .innerJoin(workspace, eq(workspaceMember.workspaceId, workspace.id))
    .where(
      and(
        eq(workspaceMember.userId, session.user.id),
        eq(workspaceMember.status, "ACTIVE"),
        eq(workspace.status, "ACTIVE"),
      ),
    )
    .orderBy(asc(workspaceMember.createdAt))
    .limit(1);

  if (!membership) redirect("/onboarding");

  const spaceIds = await getAccessibleSpaceIds(session.user.id, membership.workspaceId);
  if (spaceIds.length > 0) {
    const [firstList] = await db
      .select({ id: list.id, spaceId: list.spaceId })
      .from(list)
      .where(and(eq(list.spaceId, spaceIds[0]), eq(list.isArchived, false)))
      .orderBy(asc(list.createdAt))
      .limit(1);

    if (firstList) {
      redirect(`/${membership.workspaceId}/${firstList.spaceId}/list/${firstList.id}`);
    }
  }

  redirect("/onboarding");
}
