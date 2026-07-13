import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PRODUCT_NAME } from "@/config/platform";
import { workspace } from "@/db/schema";
import { getCurrentSession } from "@/lib/authz";
import { db } from "@/lib/db";
import { JoinError, JoinWorkspaceCard } from "./join-client";

export const metadata = { title: `Join workspace — ${PRODUCT_NAME}` };

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const session = await getCurrentSession();
  if (!session) {
    // Cookies can't be set during a Server Component render, so hand off to a
    // route handler that stashes the token and redirects to /login. After the
    // visitor signs in (any method) `/post-auth` reads the cookie and joins
    // them — no need to click the invite link a second time.
    redirect(`/api/join/${encodeURIComponent(token)}`);
  }

  const [ws] = await db
    .select({
      id: workspace.id,
      name: workspace.name,
      inviteLinkRole: workspace.inviteLinkRole,
    })
    .from(workspace)
    .where(
      and(eq(workspace.inviteLinkToken, token), eq(workspace.status, "ACTIVE"))
    );

  if (!ws) {
    return (
      <JoinError message="This invite link is invalid or has been disabled." />
    );
  }

  return (
    <JoinWorkspaceCard
      role={ws.inviteLinkRole}
      token={token}
      workspaceName={ws.name}
    />
  );
}
