import { pgEnum, pgTable, text, timestamp, integer, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const workspaceStatusEnum = pgEnum("workspace_status", ["ACTIVE", "DELETING"]);
export const workspaceRoleEnum = pgEnum("workspace_role", ["OWNER", "ADMIN", "MEMBER", "GUEST"]);
export const memberStatusEnum = pgEnum("member_status", ["ACTIVE", "INVITED"]);

/**
 * Roles a shared invite link is allowed to grant. Deliberately excludes OWNER
 * and ADMIN — a link can only ever add MEMBER or GUEST. Enforced in the
 * `setInviteLinkRole`/`joinViaLink` actions and the settings UI.
 */
export const INVITE_LINK_ROLES = ["MEMBER", "GUEST"] as const;
export type InviteLinkRole = (typeof INVITE_LINK_ROLES)[number];

export const workspace = pgTable("workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  logoEmoji: text("logo_emoji"),
  inviteLinkToken: text("invite_link_token").unique(),
  inviteLinkRole: workspaceRoleEnum("invite_link_role").notNull().default("MEMBER"),
  taskSeq: integer("task_seq").notNull().default(0),
  status: workspaceStatusEnum("status").notNull().default("ACTIVE"),
  // Accent color only — workspace-wide branding, admin-controlled. Light/dark/
  // auto is a personal preference, not workspace state — see `user.appearanceMode`.
  theme: text("theme").notNull().default("forest"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMember = pgTable(
  "workspace_member",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    email: text("email"),
    role: workspaceRoleEnum("role").notNull(),
    status: memberStatusEnum("status").notNull(),
    invitedBy: text("invited_by"),
    inviteToken: text("invite_token").unique(),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("workspace_member_workspace_id_idx").on(t.workspaceId), index("workspace_member_user_id_idx").on(t.userId)],
);
