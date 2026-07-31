"use server";

import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { user, workspace, workspaceMember } from "@/db/schema";
import { INVITE_LINK_ROLES, type InviteLinkRole } from "@/db/schema/workspace";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueEmail } from "@/lib/email";
import { workspaceInviteTemplate } from "@/lib/email/templates/workspace-invite";
import { env } from "@/lib/env";
import { createNotifications } from "@/lib/notifications/create-notification";
import { getWorkspaceMembership } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { refreshWorkspace } from "@/lib/realtime/refresh";

type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "GUEST";

/** "ADMIN" → "Admin" for user-facing notification titles. */
function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  return session;
}

async function requireAdmin(userId: string, workspaceId: string) {
  const m = await getWorkspaceMembership(userId, workspaceId);
  if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) {
    return null;
  }
  return m;
}

async function requireOwner(userId: string, workspaceId: string) {
  const m = await getWorkspaceMembership(userId, workspaceId);
  if (!m || m.role !== "OWNER") {
    return null;
  }
  return m;
}

// ── Workspace general ──────────────────────────────────────────────────────

export async function updateWorkspace(data: {
  workspaceId: string;
  name: string;
  slug: string;
  logoEmoji: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }

  const admin = await requireAdmin(session.user.id, data.workspaceId);
  if (!admin) {
    return { error: "Only admins can update the workspace" };
  }

  const name = data.name.trim();
  const slug = data.slug.trim().toLowerCase();
  if (!name) {
    return { error: "Name is required" };
  }
  if (!slug) {
    return { error: "Slug is required" };
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return { error: "Invalid slug format" };
  }

  // Check slug uniqueness
  const existing = await db
    .select({ id: workspace.id })
    .from(workspace)
    .where(and(eq(workspace.slug, slug), ne(workspace.id, data.workspaceId)));
  if (existing.length > 0) {
    return { error: "That slug is already taken" };
  }

  await db
    .update(workspace)
    .set({ name, slug, logoEmoji: data.logoEmoji, updatedAt: new Date() })
    .where(eq(workspace.id, data.workspaceId));

  void refreshWorkspace(data.workspaceId);
  return { ok: true };
}

// ── Invite link ────────────────────────────────────────────────────────────

export async function regenerateInviteLink(
  workspaceId: string
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }
  const admin = await requireAdmin(session.user.id, workspaceId);
  if (!admin) {
    return { error: "Only owners and admins can manage the invite link" };
  }

  await db
    .update(workspace)
    .set({ inviteLinkToken: createId(), updatedAt: new Date() })
    .where(eq(workspace.id, workspaceId));

  return { ok: true };
}

export async function disableInviteLink(
  workspaceId: string
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }
  const admin = await requireAdmin(session.user.id, workspaceId);
  if (!admin) {
    return { error: "Only owners and admins can manage the invite link" };
  }

  await db
    .update(workspace)
    .set({ inviteLinkToken: null, updatedAt: new Date() })
    .where(eq(workspace.id, workspaceId));

  return { ok: true };
}

/**
 * Set the role a shared invite link grants. Owners/Admins only. Constrained to
 * MEMBER or GUEST — never ADMIN/OWNER (a link must not be able to hand out
 * elevated access).
 */
export async function setInviteLinkRole(
  workspaceId: string,
  role: InviteLinkRole
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }
  const admin = await requireAdmin(session.user.id, workspaceId);
  if (!admin) {
    return { error: "Only owners and admins can manage the invite link" };
  }
  if (!INVITE_LINK_ROLES.includes(role)) {
    return { error: "Invite links can only grant the Member or Guest role" };
  }

  await db
    .update(workspace)
    .set({ inviteLinkRole: role, updatedAt: new Date() })
    .where(eq(workspace.id, workspaceId));

  void refreshWorkspace(workspaceId);
  return { ok: true };
}

/**
 * Join a workspace via its shared invite link. Authenticated users only.
 * Idempotent — an existing active member just gets routed back in, and no
 * duplicate membership row is ever created. A disabled/regenerated/deleted
 * link (token no longer matches an ACTIVE workspace) resolves to a single
 * friendly error. The granted role is clamped to the MEMBER/GUEST allow-list
 * so a bad stored value can never grant ADMIN/OWNER.
 */
export async function joinViaLink(
  token: string
): Promise<{ workspaceId: string } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }

  // Rate limit token attempts per user to slow invite-link guessing.
  if (!rateLimit(`join-link:${session.user.id}`, 20, 60_000).ok) {
    return { error: "Too many attempts. Please try again shortly." };
  }

  const [ws] = await db
    .select({
      id: workspace.id,
      inviteLinkRole: workspace.inviteLinkRole,
    })
    .from(workspace)
    .where(
      and(eq(workspace.inviteLinkToken, token), eq(workspace.status, "ACTIVE"))
    );
  if (!ws) {
    return { error: "This invite link is invalid or has been disabled." };
  }

  // Already an active member → idempotent success, no duplicate row.
  const [existing] = await db
    .select({ id: workspaceMember.id })
    .from(workspaceMember)
    .where(
      and(
        eq(workspaceMember.workspaceId, ws.id),
        eq(workspaceMember.userId, session.user.id),
        eq(workspaceMember.status, "ACTIVE")
      )
    )
    .limit(1);
  if (existing) {
    return { workspaceId: ws.id };
  }

  const role: InviteLinkRole = INVITE_LINK_ROLES.includes(
    ws.inviteLinkRole as InviteLinkRole
  )
    ? (ws.inviteLinkRole as InviteLinkRole)
    : "MEMBER";

  const now = new Date();
  await db.insert(workspaceMember).values({
    id: createId(),
    workspaceId: ws.id,
    userId: session.user.id,
    email: session.user.email?.toLowerCase() ?? null,
    role,
    status: "ACTIVE",
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  void refreshWorkspace(ws.id);
  return { workspaceId: ws.id };
}

// ── Members ────────────────────────────────────────────────────────────────

export async function inviteMember(data: {
  workspaceId: string;
  email: string;
  role: "ADMIN" | "MEMBER" | "GUEST";
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }
  const actor = await requireAdmin(session.user.id, data.workspaceId);
  if (!actor) {
    return { error: "Only admins can invite members" };
  }

  // Rate limit: 30 invites per admin per hour (curbs invite-email spam).
  if (!rateLimit(`invite:${session.user.id}`, 30, 60 * 60_000).ok) {
    return { error: "Too many invites sent. Please try again later." };
  }

  const email = data.email.trim().toLowerCase();
  if (!email) {
    return { error: "Email is required" };
  }

  // Don't duplicate active or pending invite
  const existing = await db
    .select({ id: workspaceMember.id })
    .from(workspaceMember)
    .where(
      and(
        eq(workspaceMember.workspaceId, data.workspaceId),
        eq(workspaceMember.email, email)
      )
    );
  if (existing.length > 0) {
    return { error: "This email is already a member or has a pending invite" };
  }

  const inviteToken = createId();

  await db.insert(workspaceMember).values({
    id: createId(),
    workspaceId: data.workspaceId,
    email,
    role: data.role,
    status: "INVITED",
    invitedBy: session.user.id,
    inviteToken,
    inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const ws = await db
    .select({ name: workspace.name })
    .from(workspace)
    .where(eq(workspace.id, data.workspaceId))
    .then((r) => r[0]);

  const inviteUrl = `${env.APP_URL}/invite/${inviteToken}`;
  const inviterName = session.user.name ?? session.user.email ?? "Someone";
  const workspaceName = ws?.name ?? "a workspace";

  // Dev convenience only — never log invite tokens/URLs in production.
  if (env.NODE_ENV !== "production") {
    console.log(`[invite] ${email} → ${inviteUrl}`);
  }

  const { html, text } = await workspaceInviteTemplate({
    inviterName,
    workspaceName,
    inviteUrl,
  });
  await enqueueEmail({
    to: email,
    subject: `${inviterName} invited you to ${workspaceName}`,
    html,
    text,
  });

  // In-app notification for invitees who already have an account (others get the email only).
  const [invitedUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (invitedUser) {
    createNotifications({
      workspaceId: data.workspaceId,
      actorId: session.user.id,
      recipientIds: [invitedUser.id],
      triggerType: "workspace_invited",
      entityType: "WORKSPACE",
      // entityId carries the invite TOKEN (not the workspaceId) so clicking the
      // notification opens the accept/decline page — the invitee isn't a member yet.
      entityId: inviteToken,
      title: `${inviterName} invited you to ${workspaceName}`,
    });
  }

  return { ok: true };
}

export async function resendInvite(data: {
  workspaceId: string;
  memberId: string;
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }
  const actor = await requireAdmin(session.user.id, data.workspaceId);
  if (!actor) {
    return { error: "Only admins can resend invites" };
  }

  // Rate limit: 30 invite resends per admin per hour.
  if (!rateLimit(`invite:${session.user.id}`, 30, 60 * 60_000).ok) {
    return { error: "Too many invites sent. Please try again later." };
  }

  const newToken = createId();

  const [member] = await db
    .update(workspaceMember)
    .set({
      inviteToken: newToken,
      inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaceMember.id, data.memberId),
        eq(workspaceMember.workspaceId, data.workspaceId)
      )
    )
    .returning({ email: workspaceMember.email });

  if (member?.email) {
    const ws = await db
      .select({ name: workspace.name })
      .from(workspace)
      .where(eq(workspace.id, data.workspaceId))
      .then((r) => r[0]);

    const inviteUrl = `${env.APP_URL}/invite/${newToken}`;
    const inviterName = session.user.name ?? session.user.email ?? "Someone";
    const workspaceName = ws?.name ?? "a workspace";

    // Re-deliver the in-app invite (if the invitee has an account) pointing at the
    // NEW token — the old workspace_invited notification is now stale after rotation.
    const [invitedUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, member.email))
      .limit(1);
    if (invitedUser) {
      createNotifications({
        workspaceId: data.workspaceId,
        actorId: session.user.id,
        recipientIds: [invitedUser.id],
        triggerType: "workspace_invited",
        entityType: "WORKSPACE",
        entityId: newToken,
        title: `${inviterName} invited you to ${workspaceName}`,
      });
    }

    // Email is best-effort (no SMTP in dev) — never let it fail the resend.
    try {
      // Dev convenience only — never log invite tokens/URLs in production.
      if (env.NODE_ENV !== "production") {
        console.log(`[invite] ${member.email} → ${inviteUrl}`);
      }
      const { html, text } = await workspaceInviteTemplate({
        inviterName,
        workspaceName,
        inviteUrl,
      });
      await enqueueEmail({
        to: member.email,
        subject: `${inviterName} invited you to ${workspaceName}`,
        html,
        text,
      });
    } catch (err) {
      console.error("[invite] resend email failed", err);
    }
  }

  return { ok: true };
}

export async function acceptInvite(
  token: string
): Promise<{ workspaceId: string } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }

  // Rate limit token attempts per user to slow invite-token guessing.
  if (!rateLimit(`invite-accept:${session.user.id}`, 20, 60_000).ok) {
    return { error: "Too many attempts. Please try again shortly." };
  }

  const [invite] = await db
    .select()
    .from(workspaceMember)
    .where(eq(workspaceMember.inviteToken, token));

  if (!invite) {
    return { error: "Invalid or expired invitation" };
  }

  // Idempotent short-circuit: this user already accepted this exact invite —
  // e.g. a duplicate/retry submit, or activatePendingInvites() beat us to it
  // right after sign-in. Treat as success, not an error.
  if (invite.status === "ACTIVE" && invite.userId === session.user.id) {
    return { workspaceId: invite.workspaceId };
  }
  if (invite.status !== "INVITED") {
    return { error: "This invitation has already been used" };
  }
  if (invite.inviteExpiresAt && invite.inviteExpiresAt < new Date()) {
    return { error: "This invitation has expired" };
  }

  // Check email matches if invite was for a specific address
  if (invite.email && invite.email !== session.user.email?.toLowerCase()) {
    return { error: "This invitation was sent to a different email address" };
  }

  // Atomic transition — the status="INVITED" guard closes the SELECT/UPDATE
  // race (double-click, or a concurrent activatePendingInvites() accepting
  // the same invite by email during sign-in).
  const [updated] = await db
    .update(workspaceMember)
    .set({
      userId: session.user.id,
      status: "ACTIVE",
      inviteExpiresAt: null,
      joinedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaceMember.id, invite.id),
        eq(workspaceMember.status, "INVITED") // guard against a concurrent accept
      )
    )
    .returning({ id: workspaceMember.id });

  if (!updated) {
    // Lost the race between our SELECT and UPDATE above — re-check rather
    // than assuming the token is invalid.
    const [current] = await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.id, invite.id));
    if (current?.status === "ACTIVE" && current.userId === session.user.id) {
      return { workspaceId: current.workspaceId };
    }
    return { error: "This invitation has already been used" };
  }

  // Notify the inviter that their invitation was accepted — only on the
  // winning transition, never on an idempotent short-circuit above.
  if (invite.invitedBy) {
    const accepterName = session.user.name ?? session.user.email ?? "Someone";
    const [wsRow] = await db
      .select({ name: workspace.name })
      .from(workspace)
      .where(eq(workspace.id, invite.workspaceId))
      .limit(1);
    createNotifications({
      workspaceId: invite.workspaceId,
      actorId: session.user.id,
      recipientIds: [invite.invitedBy],
      triggerType: "invite_accepted",
      entityType: "WORKSPACE",
      entityId: invite.workspaceId,
      title: `${accepterName} accepted your invitation to ${wsRow?.name ?? "your workspace"}`,
    });
  }

  return { workspaceId: invite.workspaceId };
}

export async function declineInvite(
  token: string
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }

  const [invite] = await db
    .select()
    .from(workspaceMember)
    .where(eq(workspaceMember.inviteToken, token));

  if (!invite) {
    return { error: "Invalid or expired invitation" };
  }
  if (invite.status !== "INVITED") {
    return { error: "This invitation has already been used" };
  }
  if (invite.email && invite.email !== session.user.email?.toLowerCase()) {
    return { error: "This invitation was sent to a different email address" };
  }

  await db.delete(workspaceMember).where(eq(workspaceMember.id, invite.id));

  return { ok: true };
}

/**
 * Auto-accept any pending (INVITED) memberships addressed to the signed-in
 * user's email. Called right after sign-in (from `/post-auth`) so a user who
 * was invited by email is joined automatically — without ever receiving the
 * invite email or opening the invite link. This is what makes invitations work
 * with Google-only auth and no SMTP configured.
 *
 * Matching is by email, which is safe because the email is proven by the auth
 * provider (Google / magic link) — this action only ever acts on the caller's
 * own session, never an email passed by the client.
 */
export async function activatePendingInvites(): Promise<{ activated: number }> {
  const session = await requireSession();
  if (!session) {
    return { activated: 0 };
  }

  const email = session.user.email?.toLowerCase();
  if (!email) {
    return { activated: 0 };
  }

  const now = new Date();

  const pending = await db
    .select()
    .from(workspaceMember)
    .where(
      and(
        eq(workspaceMember.email, email),
        eq(workspaceMember.status, "INVITED")
      )
    );

  let activated = 0;
  for (const invite of pending) {
    // Respect invite expiry, mirroring acceptInvite.
    if (invite.inviteExpiresAt && invite.inviteExpiresAt < now) {
      continue;
    }

    // If the user is somehow already an active member of this workspace (e.g.
    // via a row under a different email), drop the redundant invite instead of
    // creating a duplicate membership.
    const [existingActive] = await db
      .select({ id: workspaceMember.id })
      .from(workspaceMember)
      .where(
        and(
          eq(workspaceMember.workspaceId, invite.workspaceId),
          eq(workspaceMember.userId, session.user.id),
          eq(workspaceMember.status, "ACTIVE")
        )
      )
      .limit(1);
    if (existingActive) {
      await db.delete(workspaceMember).where(eq(workspaceMember.id, invite.id));
      continue;
    }

    const [updated] = await db
      .update(workspaceMember)
      .set({
        userId: session.user.id,
        status: "ACTIVE",
        inviteExpiresAt: null,
        joinedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(workspaceMember.id, invite.id),
          eq(workspaceMember.status, "INVITED") // guard against a concurrent accept
        )
      )
      .returning({ id: workspaceMember.id });

    if (!updated) {
      continue;
    }
    activated++;

    // Notify the inviter that their invitation was accepted (mirrors acceptInvite).
    if (invite.invitedBy) {
      const accepterName = session.user.name ?? session.user.email ?? "Someone";
      const [wsRow] = await db
        .select({ name: workspace.name })
        .from(workspace)
        .where(eq(workspace.id, invite.workspaceId))
        .limit(1);
      createNotifications({
        workspaceId: invite.workspaceId,
        actorId: session.user.id,
        recipientIds: [invite.invitedBy],
        triggerType: "invite_accepted",
        entityType: "WORKSPACE",
        entityId: invite.workspaceId,
        title: `${accepterName} accepted your invitation to ${wsRow?.name ?? "your workspace"}`,
      });
    }
  }

  return { activated };
}

export async function cancelInvite(data: {
  workspaceId: string;
  memberId: string;
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }
  const actor = await requireAdmin(session.user.id, data.workspaceId);
  if (!actor) {
    return { error: "Only admins can cancel invites" };
  }

  await db
    .delete(workspaceMember)
    .where(
      and(
        eq(workspaceMember.id, data.memberId),
        eq(workspaceMember.workspaceId, data.workspaceId),
        eq(workspaceMember.status, "INVITED")
      )
    );

  return { ok: true };
}

export async function changeMemberRole(data: {
  workspaceId: string;
  memberId: string;
  role: "ADMIN" | "MEMBER" | "GUEST";
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }
  const actor = await requireAdmin(session.user.id, data.workspaceId);
  if (!actor) {
    return { error: "Only admins can change roles" };
  }

  const target = await db
    .select({ role: workspaceMember.role, userId: workspaceMember.userId })
    .from(workspaceMember)
    .where(
      and(
        eq(workspaceMember.id, data.memberId),
        eq(workspaceMember.workspaceId, data.workspaceId)
      )
    );

  if (!target.length) {
    return { error: "Member not found" };
  }
  if (target[0].role === "OWNER") {
    return { error: "Cannot change owner's role" };
  }
  if (actor.role === "ADMIN" && target[0].role === "ADMIN") {
    return { error: "Admins cannot change other admins" };
  }
  if (actor.role === "ADMIN" && data.role === "ADMIN") {
    return { error: "Admins cannot grant Admin role" };
  }

  await db
    .update(workspaceMember)
    .set({ role: data.role, updatedAt: new Date() })
    .where(eq(workspaceMember.id, data.memberId));

  if (target[0].userId) {
    createNotifications({
      workspaceId: data.workspaceId,
      actorId: session.user.id,
      recipientIds: [target[0].userId],
      triggerType: "role_changed",
      entityType: "WORKSPACE",
      entityId: data.workspaceId,
      title: `Your workspace role was changed to ${roleLabel(data.role)}`,
    });
  }

  return { ok: true };
}

export async function removeMember(data: {
  workspaceId: string;
  memberId: string;
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }
  const actor = await requireAdmin(session.user.id, data.workspaceId);
  if (!actor) {
    return { error: "Only admins can remove members" };
  }

  const target = await db
    .select({ role: workspaceMember.role, userId: workspaceMember.userId })
    .from(workspaceMember)
    .where(
      and(
        eq(workspaceMember.id, data.memberId),
        eq(workspaceMember.workspaceId, data.workspaceId)
      )
    );

  if (!target.length) {
    return { error: "Member not found" };
  }
  if (target[0].role === "OWNER") {
    return { error: "Cannot remove the owner" };
  }
  if (target[0].userId === session.user.id) {
    return { error: "Cannot remove yourself" };
  }

  await db.delete(workspaceMember).where(eq(workspaceMember.id, data.memberId));

  // Notify the removed member so they understand why they lost access.
  if (target[0].userId) {
    const actorName = session.user.name ?? session.user.email ?? "Someone";
    const [wsRow] = await db
      .select({ name: workspace.name })
      .from(workspace)
      .where(eq(workspace.id, data.workspaceId))
      .limit(1);
    createNotifications({
      workspaceId: data.workspaceId,
      actorId: session.user.id,
      recipientIds: [target[0].userId],
      triggerType: "workspace_removed",
      entityType: "WORKSPACE",
      entityId: data.workspaceId,
      title: `${actorName} removed you from ${wsRow?.name ?? "the workspace"}`,
    });
  }

  return { ok: true };
}

export async function transferOwnership(data: {
  workspaceId: string;
  targetMemberId: string;
  confirmName: string;
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }
  const owner = await requireOwner(session.user.id, data.workspaceId);
  if (!owner) {
    return { error: "Only the owner can transfer ownership" };
  }

  const [ws] = await db
    .select({ name: workspace.name })
    .from(workspace)
    .where(eq(workspace.id, data.workspaceId));
  if (!ws) {
    return { error: "Workspace not found" };
  }
  if (data.confirmName.trim() !== ws.name.trim()) {
    return { error: "Workspace name does not match" };
  }

  const [ownerMember] = await db
    .select({ id: workspaceMember.id })
    .from(workspaceMember)
    .where(
      and(
        eq(workspaceMember.workspaceId, data.workspaceId),
        eq(workspaceMember.userId, session.user.id),
        eq(workspaceMember.status, "ACTIVE")
      )
    );

  await db.transaction(async (tx) => {
    await tx
      .update(workspaceMember)
      .set({ role: "OWNER", updatedAt: new Date() })
      .where(eq(workspaceMember.id, data.targetMemberId));
    if (ownerMember) {
      await tx
        .update(workspaceMember)
        .set({ role: "ADMIN", updatedAt: new Date() })
        .where(eq(workspaceMember.id, ownerMember.id));
    }
  });

  return { ok: true };
}

export async function deleteWorkspace(data: {
  workspaceId: string;
  confirmName: string;
}): Promise<{ ok: true; nextWorkspaceId: string | null } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }
  const owner = await requireOwner(session.user.id, data.workspaceId);
  if (!owner) {
    return { error: "Only the owner can delete the workspace" };
  }

  const [ws] = await db
    .select({ name: workspace.name })
    .from(workspace)
    .where(eq(workspace.id, data.workspaceId));
  if (!ws) {
    return { error: "Workspace not found" };
  }
  if (data.confirmName.trim() !== ws.name.trim()) {
    return { error: "Workspace name does not match" };
  }

  await db
    .update(workspace)
    .set({ status: "DELETING", updatedAt: new Date() })
    .where(eq(workspace.id, data.workspaceId));

  // Where should the owner land now that this workspace is gone? Pick their
  // next active workspace (if any) so the client can navigate straight there;
  // otherwise the client sends them to onboarding (create-workspace step).
  const [next] = await db
    .select({ id: workspace.id })
    .from(workspaceMember)
    .innerJoin(workspace, eq(workspaceMember.workspaceId, workspace.id))
    .where(
      and(
        eq(workspaceMember.userId, session.user.id),
        eq(workspaceMember.status, "ACTIVE"),
        eq(workspace.status, "ACTIVE"),
        ne(workspace.id, data.workspaceId)
      )
    )
    .orderBy(asc(workspaceMember.createdAt))
    .limit(1);

  return { ok: true, nextWorkspaceId: next?.id ?? null };
}

// Accent color only — this is shared workspace branding, admin-controlled.
// Light/dark/auto is a personal preference; see `updateAppearanceMode` in
// app/actions/profile.ts.
export async function updateWorkspaceTheme(data: {
  workspaceId: string;
  theme: string;
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (!session) {
    return { error: "Unauthorized" };
  }

  const admin = await requireAdmin(session.user.id, data.workspaceId);
  if (!admin) {
    return { error: "Only admins can update workspace theme settings" };
  }

  await db
    .update(workspace)
    .set({
      theme: data.theme,
      updatedAt: new Date(),
    })
    .where(eq(workspace.id, data.workspaceId));

  return { ok: true };
}
