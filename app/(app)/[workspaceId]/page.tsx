import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { workspace } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWorkspaceMembership } from "@/lib/permissions";
import { getWorkspaceLandingState } from "@/lib/workspace-landing";
import { ArchivedProjectsEmptyState } from "./_components/archived-projects-empty-state";
import { EmptyWorkspace } from "./_components/empty-workspace";

interface WorkspaceHomeProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspaceHomePage({
  params,
}: WorkspaceHomeProps) {
  const { workspaceId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    notFound();
  }

  const landing = await getWorkspaceLandingState(session.user.id, workspaceId);

  switch (landing.kind) {
    case "ACTIVE_SPACE":
      // redirect() throws, so no case falls through.
      redirect(
        landing.listId
          ? `/${workspaceId}/${landing.spaceId}/list/${landing.listId}`
          : `/${workspaceId}/${landing.spaceId}`
      );
      break;
    case "EMPTY":
      // Truly empty workspace — non-guests create their first project.
      redirect("/onboarding");
      break;
    case "ONLY_ARCHIVED": {
      // Projects exist but are all archived: stay in the workspace and let the
      // user restore one (admins) instead of forcing the onboarding wizard.
      const canManage =
        membership.role === "OWNER" || membership.role === "ADMIN";
      return (
        <ArchivedProjectsEmptyState
          archived={landing.archived}
          canManage={canManage}
          workspaceId={workspaceId}
        />
      );
    }
    default: {
      // NO_ACCESS — a guest (or member with no accessible projects).
      const [ws] = await db
        .select({ name: workspace.name })
        .from(workspace)
        .where(eq(workspace.id, workspaceId))
        .limit(1);
      return <EmptyWorkspace workspaceName={ws?.name ?? "this workspace"} />;
    }
  }
}
