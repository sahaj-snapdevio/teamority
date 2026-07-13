import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { list, workspace } from "@/db/schema";
import { getAccessibleSpaceIds, getWorkspaceMembership } from "@/lib/permissions";
import { EmptyWorkspace } from "./_components/empty-workspace";

interface WorkspaceHomeProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspaceHomePage({ params }: WorkspaceHomeProps) {
  const { workspaceId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) notFound();

  const spaceIds = await getAccessibleSpaceIds(session.user.id, workspaceId);
  if (spaceIds.length > 0) {
    const [firstList] = await db
      .select({ id: list.id, spaceId: list.spaceId })
      .from(list)
      .where(and(inArray(list.spaceId, spaceIds), eq(list.isArchived, false)))
      .orderBy(asc(list.createdAt))
      .limit(1);

    if (firstList) redirect(`/${workspaceId}/${firstList.spaceId}/list/${firstList.id}`);
  }

  // A guest is a valid workspace member but cannot create projects. Instead of
  // bouncing them to the create-project onboarding wizard (which they can't
  // complete), keep them inside the workspace shell with an empty state. Owners/
  // admins/members retain the existing "create your first project" onboarding.
  if (membership.role === "GUEST") {
    const [ws] = await db
      .select({ name: workspace.name })
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .limit(1);
    return <EmptyWorkspace workspaceName={ws?.name ?? "this workspace"} />;
  }

  redirect("/onboarding");
}
