import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ListStatusesSettings } from "@/components/list/list-statuses-settings";
import { list, listStatus } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface PageProps {
  params: Promise<{ workspaceId: string; spaceId: string; listId: string }>;
}

export default async function ListStatusesSettingsPage({ params }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const { workspaceId, spaceId, listId } = await params;

  const [l] = await db
    .select({ id: list.id })
    .from(list)
    .where(and(eq(list.id, listId), eq(list.spaceId, spaceId)));
  if (!l) {
    notFound();
  }

  const statuses = await db
    .select({
      id: listStatus.id,
      name: listStatus.name,
      color: listStatus.color,
      type: listStatus.type,
      dashboardCategory: listStatus.dashboardCategory,
      orderIndex: listStatus.orderIndex,
    })
    .from(listStatus)
    .where(eq(listStatus.listId, listId))
    .orderBy(listStatus.orderIndex);

  return (
    <ListStatusesSettings
      initialStatuses={statuses}
      listId={listId}
      spaceId={spaceId}
      workspaceId={workspaceId}
    />
  );
}
