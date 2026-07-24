import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { list } from "@/db/schema";
import { getSpacePermission } from "@/lib/permissions";
import { ListSettingsNav } from "@/components/list/list-settings-nav";
import { TopbarTitle } from "@/components/common/topbar-title";

interface ListSettingsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string; spaceId: string; listId: string }>;
}

export default async function ListSettingsLayout({ children, params }: ListSettingsLayoutProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { workspaceId, spaceId, listId } = await params;

  const permission = await getSpacePermission(session.user.id, workspaceId, spaceId);
  if (!permission || (permission !== "full_access")) redirect(`/${workspaceId}/${spaceId}/list/${listId}`);

  const [l] = await db
    .select({ name: list.name })
    .from(list)
    .where(and(eq(list.id, listId), eq(list.spaceId, spaceId)));
  if (!l) notFound();

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Page header lives in the topbar. The list crumb links back to the
          list, so "back to list" stays reachable without a second header. */}
      <TopbarTitle
        breadcrumbs={[
          { label: l.name, href: `/${workspaceId}/${spaceId}/list/${listId}` },
        ]}
        title="Settings"
      />
      <ListSettingsNav workspaceId={workspaceId} spaceId={spaceId} listId={listId} />
      {children}
    </div>
  );
}
