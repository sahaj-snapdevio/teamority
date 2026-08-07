"use client";

import { XIcon } from "@phosphor-icons/react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import { UserAvatar } from "@/components/common/user-avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getNotificationTarget } from "@/lib/notifications/target";
import { cn } from "@/lib/utils";

interface Notification {
  actorId: string | null;
  actorImage: string | null;
  actorName: string | null;
  body: string | null;
  createdAt: string;
  entityId: string;
  entityType: string;
  id: string;
  isRead: boolean;
  readAt: string | null;
  title: string;
  triggerType: string;
  workspaceIcon: string | null;
  workspaceId: string;
  workspaceName: string | null;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface NotificationPanelProps {
  onClose: () => void;
  open: boolean;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<
    "all" | "unread" | "mentions"
  >("all");

  const {
    data,
    isLoading,
    mutate: revalidate,
  } = useSWR<NotificationsResponse>(
    open ? `/api/me/notifications?filter=${activeTab}` : null,
    fetcher
  );

  const notifications = data?.notifications ?? [];

  async function markAllRead() {
    const res = await fetch("/api/me/notifications/read-all", {
      method: "PATCH",
    });
    await revalidate();
    await mutate("/api/me/notifications?filter=unread");
    if (!res.ok) {
      toast.error("Couldn't mark notifications as read");
      return;
    }
    const { count = 0 } = await res.json().catch(() => ({ count: 0 }));
    toast.success(
      count > 0
        ? `${count} notification${count === 1 ? "" : "s"} marked as read`
        : "You're all caught up"
    );
  }

  async function clearAll() {
    const res = await fetch("/api/me/notifications", { method: "DELETE" });
    await revalidate();
    await mutate("/api/me/notifications?filter=unread");
    if (!res.ok) {
      toast.error("Couldn't clear notifications");
      return;
    }
    const { count = 0 } = await res.json().catch(() => ({ count: 0 }));
    toast.success(
      count > 0
        ? `${count} notification${count === 1 ? "" : "s"} cleared`
        : "No notifications to clear"
    );
  }

  async function markRead(id: string) {
    await fetch(`/api/me/notifications/${id}/read`, { method: "PATCH" });
    await revalidate();
    await mutate("/api/me/notifications?filter=unread");
  }

  async function deleteNotification(id: string) {
    await fetch(`/api/me/notifications/${id}`, { method: "DELETE" });
    await revalidate();
    await mutate("/api/me/notifications?filter=unread");
  }

  function handleNotificationClick(n: Notification) {
    if (!n.isRead) {
      void markRead(n.id);
    }
    // Resolve the destination from the notification's OWN workspace, so any
    // notification type navigates and switches into the right workspace.
    const target = getNotificationTarget(n);
    if (target.type === "info") {
      toast.info(target.message);
      return;
    }
    router.push(
      target.type === "task"
        ? `/${n.workspaceId}/task/${n.entityId}`
        : target.href
    );
    onClose();
  }

  return (
    <Sheet onOpenChange={(o) => !o && onClose()} open={open}>
      <SheetContent
        className="flex w-full flex-col p-0 sm:max-w-md rounded-l-4xl"
        side="right"
      >
        <SheetHeader className="relative border-b pl-4 pr-10 pt-3 pb-2 flex flex-col gap-2">
          {/* Row 1: Title + actions (pr-10 clears the Sheet close button) */}
          <div className="flex items-center justify-between">
            <SheetTitle>Notifications</SheetTitle>
            <div className="flex items-center gap-3">
              <button
                className="text-xs text-base-content/60 hover:text-base-content transition-colors cursor-pointer"
                onClick={markAllRead}
              >
                Mark all as read
              </button>
              <span className="text-base-content/40 text-xs select-none">
                |
              </span>
              <button
                className="text-xs text-base-content/60 hover:text-error transition-colors cursor-pointer"
                onClick={clearAll}
              >
                Clear all
              </button>
            </div>
          </div>

          {/* Row 2: Tabs */}
          <Tabs
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            value={activeTab}
          >
            <TabsList className="h-8 rounded-4xl p-2">
              <TabsTrigger
                className="text-xs px-3 h-7 rounded-4xl cursor-pointer"
                value="all"
              >
                All
              </TabsTrigger>
              <TabsTrigger
                className="text-xs px-3 h-7 rounded-4xl cursor-pointer"
                value="unread"
              >
                Unread
              </TabsTrigger>
              <TabsTrigger
                className="text-xs px-3 h-7 rounded-4xl cursor-pointer"
                value="mentions"
              >
                Mentions
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-sm text-base-content/60">
              Loading…
            </div>
          )}
          {!isLoading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-medium text-base-content/60">
                No notifications
              </p>
              <p className="mt-1 text-xs text-base-content/60">
                You&apos;re all caught up!
              </p>
            </div>
          )}
          {notifications.map((n) => (
            <div
              className={cn(
                "group relative flex cursor-pointer items-start gap-3 border-b px-4 py-3 transition-colors hover:bg-base-200/50",
                !n.isRead && "bg-blue-50/50 dark:bg-blue-950/20"
              )}
              key={n.id}
              onClick={() => handleNotificationClick(n)}
            >
              {/* Unread dot */}
              {!n.isRead && (
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              )}
              {n.isRead && <span className="mt-2 h-2 w-2 shrink-0" />}

              {/* Actor avatar */}
              <UserAvatar
                className="mt-0.5 shrink-0"
                image={n.actorImage}
                name={n.actorName}
                size="sm"
              />

              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">{n.title}</p>
                {n.body && (
                  <p className="mt-0.5 text-xs text-base-content/60 line-clamp-2 italic">
                    {n.body}
                  </p>
                )}
                <p className="mt-1 flex items-center gap-1 text-xs text-base-content/60">
                  {n.workspaceName && (
                    <>
                      <span className="flex min-w-0 items-center gap-1 font-medium">
                        <span aria-hidden className="shrink-0">
                          {n.workspaceIcon ?? "📁"}
                        </span>
                        <span className="truncate">{n.workspaceName}</span>
                      </span>
                      <span aria-hidden>·</span>
                    </>
                  )}
                  <span className="shrink-0">
                    {formatDistanceToNow(new Date(n.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </p>
              </div>

              {/* Delete button — always visible on mobile (no hover to reveal
                  it there); hidden until hover/focus at sm+ to match desktop. */}
              <button
                className="absolute right-2 top-2 flex size-5 items-center justify-center rounded hover:bg-base-200 sm:hidden sm:group-hover:flex"
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteNotification(n.id);
                }}
                title="Dismiss"
              >
                <XIcon className="size-3 text-base-content/60" />
              </button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
