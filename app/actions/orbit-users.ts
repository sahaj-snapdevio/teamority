"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ADMIN_ROLE, USER_ROLE } from "@/config/platform";
import { user } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { purgeUser, soleOwnedWorkspaces } from "@/lib/user-deletion";

export async function setUserRoleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? USER_ROLE);

  if (![ADMIN_ROLE, USER_ROLE].includes(role)) {
    return;
  }
  if (userId === admin.user.id && role !== ADMIN_ROLE) {
    return;
  }

  await db
    .update(user)
    .set({ role, updatedAt: new Date() })
    .where(eq(user.id, userId));

  await audit({
    action: "orbit.user_role_updated",
    actorEmail: admin.user.email,
    actorId: admin.user.id,
    description: `Updated user role to ${role}`,
    entityId: userId,
    entityType: "user",
    metadata: { role },
  });

  revalidatePath("/orbit/users");
}

export async function toggleUserBanAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const banned = String(formData.get("banned") ?? "false") === "true";

  if (userId === admin.user.id && banned) {
    return;
  }

  await db
    .update(user)
    .set({
      banReason: banned ? "Disabled by Orbit admin" : null,
      banned,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));

  await audit({
    action: banned ? "orbit.user_banned" : "orbit.user_unbanned",
    actorEmail: admin.user.email,
    actorId: admin.user.id,
    description: banned ? "Banned user" : "Unbanned user",
    entityId: userId,
    entityType: "user",
  });

  revalidatePath("/orbit/users");
}

export async function deleteUserAction(
  userId: string
): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  if (userId === admin.user.id) {
    return { error: "You can't delete your own account from Orbit." };
  }

  const targetUser = await db
    .select({ email: user.email, id: user.id, image: user.image })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!targetUser) {
    return { error: "User not found." };
  }

  const soleOwned = await soleOwnedWorkspaces(userId);
  if (soleOwned.length > 0) {
    return {
      error:
        "This user is the sole owner of one or more workspaces. Transfer ownership to another member before deleting them.",
    };
  }

  await purgeUser(userId, targetUser.image);

  await audit({
    action: "orbit.user_deleted",
    actorEmail: admin.user.email,
    actorId: admin.user.id,
    description: `Deleted user ${targetUser.email}`,
    entityId: userId,
    entityType: "user",
  });

  revalidatePath("/orbit/users");
  return {};
}
