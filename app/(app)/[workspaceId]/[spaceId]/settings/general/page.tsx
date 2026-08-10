import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SpaceGeneralSettingsForm } from "@/components/space/space-general-settings-form";
import { space } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWorkspaceMembership } from "@/lib/permissions";

interface PageProps {
  params: Promise<{ workspaceId: string; spaceId: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { spaceId, workspaceId } = await params;
  const row = await db
    .select({ name: space.name })
    .from(space)
    .where(and(eq(space.id, spaceId), eq(space.workspaceId, workspaceId)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) {
    return { title: "Project Settings" };
  }
  return { title: `${row.name} · Settings` };
}

export default async function SpaceGeneralSettingsPage({ params }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const { workspaceId, spaceId } = await params;

  const [s] = await db
    .select({
      name: space.name,
      color: space.color,
      logoEmoji: space.logoEmoji,
      isPrivate: space.isPrivate,
      isArchived: space.isArchived,
    })
    .from(space)
    .where(and(eq(space.id, spaceId), eq(space.workspaceId, workspaceId)));
  if (!s) {
    notFound();
  }

  const wm = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!wm) {
    notFound();
  }
  const isAdmin = wm.role === "OWNER" || wm.role === "ADMIN";

  return (
    <SpaceGeneralSettingsForm
      isAdmin={isAdmin}
      isArchived={s.isArchived}
      isPrivate={s.isPrivate}
      spaceColor={s.color}
      spaceId={spaceId}
      spaceLogoEmoji={s.logoEmoji}
      spaceName={s.name}
      workspaceId={workspaceId}
    />
  );
}
