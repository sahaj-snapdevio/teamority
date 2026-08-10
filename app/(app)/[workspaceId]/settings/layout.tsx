import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TopbarTitle } from "@/components/common/topbar-title";
import { SettingsNav } from "@/components/workspace/settings-nav";
import { auth } from "@/lib/auth";
import { getWorkspaceMembership } from "@/lib/permissions";

interface SettingsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}

export default async function SettingsLayout({
  children,
  params,
}: SettingsLayoutProps) {
  const { workspaceId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const membership = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    redirect(`/${workspaceId}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Page header lives in the topbar — see components/common/topbar-title. */}
      <TopbarTitle title="Workspace Settings" />
      <div className="flex flex-col gap-6 md:flex-row">
        <SettingsNav
          isOwner={membership.role === "OWNER"}
          workspaceId={workspaceId}
        />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
