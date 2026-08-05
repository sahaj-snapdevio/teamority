import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceOverviewView } from "@/components/workspace-overview/workspace-overview-view";
import { auth } from "@/lib/auth";
import { getWorkspaceMembership } from "@/lib/permissions";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspaceOverviewPage({ params }: Props) {
  const { workspaceId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership) {
    redirect("/");
  }

  return <WorkspaceOverviewView workspaceId={workspaceId} />;
}

export const metadata = { title: "Overview" };
