import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { workspace, workspaceMember } from "@/db/schema";
import { db } from "@/lib/db";
import { getAccessibleSpaceIds } from "@/lib/permissions";
import { activatePendingInvites } from "@/app/actions/workspace";
import { readPendingJoin } from "@/lib/pending-join";
import { list } from "@/db/schema";

export default async function PostAuthPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // Auto-accept any invitations addressed to this user's email so invited users
  // (e.g. signing in with Google, no SMTP configured) are joined without needing
  // the invite email/link. Must run before the membership lookup below so a
  // freshly-activated workspace is picked up for the redirect.
  await activatePendingInvites();

  // Continue a shared-invite-link join that started while logged out: the token
  // was stashed in a cookie at `/join/[token]` and survives the auth round-trip
  // (incl. Google OAuth). The actual join + cookie-clear happens in a route
  // handler (cookies can't be mutated during a page render); it redirects to the
  // workspace on success, or back here (cookie cleared) to fall through on error.
  if (await readPendingJoin()) redirect("/api/join/consume");

  // Platform admins are normal users with extra capabilities — they land in the
  // regular app (their workspaces), and reach the Admin Console via the sidebar.

  const [membership] = await db
    .select({
      workspaceId: workspaceMember.workspaceId,
      role: workspaceMember.role,
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

  // A guest with no accessible projects is still a valid member — land them in
  // their workspace (which renders an empty state), not the create-project
  // onboarding wizard they can't complete.
  if (membership.role === "GUEST") {
    redirect(`/${membership.workspaceId}`);
  }

  redirect("/onboarding");
}
