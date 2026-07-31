"use client";

import {
  ArrowSquareOutIcon,
  CaretLeftIcon,
  CaretRightIcon,
  EnvelopeIcon,
  EnvelopeOpenIcon,
  FunnelIcon,
  XIcon,
} from "@phosphor-icons/react";
import {
  formatDistanceToNow,
  isToday,
  isYesterday,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import useSWR, { mutate as globalMutate } from "swr";
import { getTaskLocation } from "@/app/actions/task";
import {
  FacetFilter,
  type FacetOption,
} from "@/components/filters/facet-filter";
import { TaskDetailPanel } from "@/components/task/task-detail-panel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SearchInput } from "@/components/ui/search-input";
import {
  EVENT_FILTERS,
  NOTIFICATIONS_PAGE_SIZE,
} from "@/lib/notifications/filters";
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
  page: number;
  totalCount: number;
  unreadCount: number;
}

interface TaskLocation {
  listId: string | null;
  notifId: string;
  spaceId: string;
  taskId: string;
  workspaceId: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Stable keys for the loading skeleton rows (avoids array-index keys).
const SKELETON_KEYS = ["k0", "k1", "k2", "k3", "k4", "k5"];

// Date filter options. Bounds are computed in the viewer's local timezone and
// snapped to startOfDay/startOfMonth so the SWR key stays stable across renders
// (and consistent with the client-side date grouping).
const DATE_FILTERS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "older", label: "Older" },
];

function dateRange(key: string): { after?: string; before?: string } {
  const now = new Date();
  const startToday = startOfDay(now);
  switch (key) {
    case "today":
      return { after: startToday.toISOString() };
    case "yesterday":
      return {
        after: startOfDay(subDays(now, 1)).toISOString(),
        before: startToday.toISOString(),
      };
    case "last_7_days":
      return { after: startOfDay(subDays(now, 6)).toISOString() };
    case "last_30_days":
      return { after: startOfDay(subDays(now, 29)).toISOString() };
    case "this_month":
      return { after: startOfMonth(now).toISOString() };
    case "older":
      return { before: startOfDay(subDays(now, 7)).toISOString() };
    default:
      return {};
  }
}

type Tab = "all" | "unread" | "mentions";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "mentions", label: "Mentions" },
];

function getInitials(name: string | null) {
  if (!name) {
    return "?";
  }
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function InboxPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTask, setSelectedTask] = React.useState<TaskLocation | null>(
    null
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  // Filters live in the URL so they survive refresh and are shareable.
  const activeTab = (searchParams.get("filter") as Tab | null) ?? "all";
  const dateFilter = searchParams.get("date") ?? "";
  const workspaceFilter = searchParams.get("workspace") ?? "";
  const eventFilter = searchParams.get("event") ?? "";
  const q = searchParams.get("q") ?? "";

  // Live ref to the current params so debounced/updater callbacks never merge
  // into a stale query string.
  const paramsRef = React.useRef(searchParams);
  paramsRef.current = searchParams;
  const updateParams = React.useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(paramsRef.current.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router]
  );

  // The search field is debounced into the URL to avoid a request per keystroke.
  const [searchDraft, setSearchDraft] = React.useState(q);
  React.useEffect(() => {
    setSearchDraft(q); // keep in sync with back/forward or a Clear action
  }, [q]);
  React.useEffect(() => {
    if (searchDraft === q) {
      return;
    }
    const timer = setTimeout(
      () => updateParams({ q: searchDraft || null }),
      300
    );
    return () => clearTimeout(timer);
  }, [searchDraft, q, updateParams]);

  // Workspaces the user has notifications from — powers the Workspace dropdown.
  const { data: wsData } = useSWR<{
    workspaces: { id: string; name: string; icon: string | null }[];
  }>("/api/me/notification-workspaces", fetcher);
  const workspaceOptions: FacetOption[] = React.useMemo(
    () =>
      (wsData?.workspaces ?? []).map((w) => ({
        value: w.id,
        label: w.name,
        icon: <span aria-hidden>{w.icon ?? "📁"}</span>,
      })),
    [wsData]
  );

  // Gmail-style fixed pagination — one 50-row page fetched at a time, instead
  // of infinite scroll. `page` is local (not URL-synced, like Gmail); it
  // resets to 1 whenever a filter changes below.
  const [page, setPage] = React.useState(1);

  // Build the filtered + paginated notifications URL. All active filters
  // combine (AND); date bounds are resolved client-side and passed as ISO
  // instants.
  const url = React.useMemo(() => {
    const p = new URLSearchParams();
    p.set("filter", activeTab);
    if (q) {
      p.set("q", q);
    }
    if (workspaceFilter) {
      p.set("workspace", workspaceFilter);
    }
    if (eventFilter) {
      p.set("event", eventFilter);
    }
    if (dateFilter) {
      const { after, before } = dateRange(dateFilter);
      if (after) {
        p.set("after", after);
      }
      if (before) {
        p.set("before", before);
      }
    }
    p.set("page", String(page));
    return `/api/me/notifications?${p.toString()}`;
  }, [activeTab, q, workspaceFilter, eventFilter, dateFilter, page]);

  const { data, isLoading, isValidating, mutate } =
    useSWR<NotificationsResponse>(url, fetcher, {
      keepPreviousData: true, // avoid a blank flash when flipping pages
      refreshInterval: 15_000,
    });

  // Changing any filter changes `url`'s query — reset back to page 1 so a
  // filter change never leaves the view stranded on a since-invalid page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on filter change
  React.useEffect(() => {
    setPage(1);
  }, [activeTab, q, workspaceFilter, eventFilter, dateFilter]);

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const totalCount = data?.totalCount ?? 0;

  const isLoadingInitial = isLoading;
  const isEmpty = !isLoadingInitial && notifications.length === 0;

  const pageStart =
    totalCount === 0 ? 0 : (page - 1) * NOTIFICATIONS_PAGE_SIZE + 1;
  const pageEnd = Math.min(page * NOTIFICATIONS_PAGE_SIZE, totalCount);
  const canGoPrev = page > 1;
  const canGoNext = page * NOTIFICATIONS_PAGE_SIZE < totalCount;

  // Bucket into Today / Yesterday / Last 7 Days / Older. Ordering is preserved
  // (newest first); a header is emitted wherever the bucket changes. Buckets
  // are scoped to the current page only — a day can split across a page
  // boundary, same trade-off Gmail-style pagination always makes.
  const groups = React.useMemo(() => {
    const weekAgo = subDays(new Date(), 7);
    const out: { label: string; items: Notification[] }[] = [];
    for (const n of notifications) {
      const d = new Date(n.createdAt);
      const label = isToday(d)
        ? "Today"
        : isYesterday(d)
          ? "Yesterday"
          : d >= weekAgo
            ? "Last 7 Days"
            : "Older";
      const last = out.at(-1);
      if (last && last.label === label) {
        last.items.push(n);
      } else {
        out.push({ label, items: [n] });
      }
    }
    return out;
  }, [notifications]);

  // Scroll the list back to top whenever the page changes.
  const scrollRef = React.useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on page change
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page]);

  // Optimistic cache patch — updates only the affected notification(s) without
  // refetching the whole list (Goals 4 & 5). `transform` returns the updated
  // notification, or null to remove it; the displayed unread total is adjusted
  // by how many unread items were read/removed (or made unread again).
  function patchNotifications(
    transform: (n: Notification) => Notification | null
  ) {
    return mutate(
      (current) => {
        if (!current) {
          return current;
        }
        let unreadDelta = 0;
        const next: Notification[] = [];
        for (const n of current.notifications) {
          const wasUnread = !n.isRead;
          const u = transform(n);
          if (u === null) {
            if (wasUnread) {
              unreadDelta += 1;
            }
            continue;
          }
          const nowUnread = !u.isRead;
          if (wasUnread && !nowUnread) {
            unreadDelta += 1;
          } else if (!wasUnread && nowUnread) {
            unreadDelta -= 1;
          }
          next.push(u);
        }
        // A removed/no-longer-matching item (dismissed, or read while on the
        // Unread tab) also drops out of the current filter's total.
        const removedCount = current.notifications.length - next.length;
        return {
          ...current,
          notifications: next,
          unreadCount: Math.max(0, current.unreadCount - unreadDelta),
          totalCount: Math.max(0, current.totalCount - removedCount),
        };
      },
      { revalidate: false }
    );
  }

  async function markRead(id: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    // On the Unread tab a read notification no longer belongs — drop it;
    // elsewhere flip its state in place.
    await patchNotifications((n) =>
      n.id === id
        ? activeTab === "unread"
          ? null
          : { ...n, isRead: true, readAt: new Date().toISOString() }
        : n
    );
    await fetch(`/api/me/notifications/${id}/read`, { method: "PATCH" });
    await globalMutate("/api/me/notifications?filter=unread");
  }

  async function markUnread(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await patchNotifications((n) =>
      n.id === id ? { ...n, isRead: false, readAt: null } : n
    );
    await fetch(`/api/me/notifications/${id}/unread`, { method: "PATCH" });
    await globalMutate("/api/me/notifications?filter=unread");
  }

  async function dismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await patchNotifications((n) => (n.id === id ? null : n));
    await fetch(`/api/me/notifications/${id}`, { method: "DELETE" });
    await globalMutate("/api/me/notifications?filter=unread");
    // Close panel if the dismissed notification's task is open
    setSelectedTask(null);
  }

  async function markAllRead() {
    await mutate(
      (current) => {
        if (!current) {
          return current;
        }
        // Marking read is global (every notification, not just this page),
        // so on the Unread tab the whole filtered total goes to zero too.
        if (activeTab === "unread") {
          return {
            ...current,
            notifications: [],
            unreadCount: 0,
            totalCount: 0,
          };
        }
        return {
          ...current,
          unreadCount: 0,
          notifications: current.notifications.map((n) =>
            n.isRead
              ? n
              : { ...n, isRead: true, readAt: new Date().toISOString() }
          ),
        };
      },
      { revalidate: false }
    );
    const res = await fetch("/api/me/notifications/read-all", {
      method: "PATCH",
    });
    await globalMutate("/api/me/notifications?filter=unread");
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
    await mutate(
      { notifications: [], page: 1, totalCount: 0, unreadCount: 0 },
      { revalidate: false }
    );
    setPage(1);
    setSelectedTask(null);
    const res = await fetch("/api/me/notifications", { method: "DELETE" });
    await globalMutate("/api/me/notifications?filter=unread");
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

  // Clicking marks read (notification stays in the Inbox) and then opens the
  // destination when there is one, or explains why there isn't.
  async function handleRowClick(n: Notification) {
    if (!n.isRead) {
      void markRead(n.id);
    }

    const target = getNotificationTarget(n);

    if (target.type === "info") {
      toast.info(target.message);
      return;
    }

    if (target.type === "route") {
      router.push(target.href);
      return;
    }

    // target.type === "task". When the task lives in ANOTHER workspace, navigate
    // to it so the app switches into that workspace (the inline panel can't
    // switch the surrounding shell). Same-workspace tasks keep the lightweight
    // inline panel.
    if (n.workspaceId !== workspaceId) {
      router.push(`/${n.workspaceId}/task/${n.entityId}`);
      return;
    }

    // Toggle-close only when re-clicking the SAME notification row — multiple
    // notifications can point at the same task, so we key off the notification id,
    // not the task id (otherwise clicking a sibling notification would just close it).
    if (selectedTask?.notifId === n.id) {
      setSelectedTask(null); // toggle closed
      return;
    }
    const result = await getTaskLocation(n.workspaceId, n.entityId);
    if ("error" in result) {
      toast.info("This task no longer exists.");
      return;
    }
    setSelectedTask({
      notifId: n.id,
      taskId: n.entityId,
      workspaceId: n.workspaceId,
      spaceId: result.spaceId,
      listId: result.listId,
    });
  }

  const activeFilterCount =
    (dateFilter ? 1 : 0) + (workspaceFilter ? 1 : 0) + (eventFilter ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || q.length > 0;

  function clearFilters() {
    setSearchDraft("");
    updateParams({ q: null, date: null, workspace: null, event: null });
  }

  // Date / Workspace / Event dropdowns — shared by the desktop bar and the
  // mobile filter sheet. Reuses the app-wide FacetFilter (single-select).
  const renderFilters = () => (
    <>
      <FacetFilter
        label="Date"
        onChange={(next) => updateParams({ date: next[0] ?? null })}
        options={DATE_FILTERS.map((d) => ({ value: d.value, label: d.label }))}
        selected={dateFilter ? [dateFilter] : []}
        single
      />
      <FacetFilter
        label="Workspace"
        onChange={(next) => updateParams({ workspace: next[0] ?? null })}
        options={workspaceOptions}
        searchable
        selected={workspaceFilter ? [workspaceFilter] : []}
        single
      />
      <FacetFilter
        label="Event"
        onChange={(next) => updateParams({ event: next[0] ?? null })}
        options={EVENT_FILTERS.map((e) => ({ value: e.value, label: e.label }))}
        searchable
        selected={eventFilter ? [eventFilter] : []}
        single
      />
    </>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Notification list. `@container` lets the filter bar respond to THIS
          column's width, so it collapses to the compact Filters button when the
          column is narrow — whether from a small viewport or an open task. */}
      <div
        className={cn(
          "@container flex flex-col h-full transition-all duration-200 min-w-0",
          selectedTask ? "w-105 shrink-0 border-r" : "flex-1"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Inbox</h1>
            {/* Scoped to the active Date/Workspace/Event/search filters (the
                API counts unread within the same scope), so it always matches
                what the Unread tab would list. */}
            {unreadCount > 0 && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-semibold text-white leading-none"
                title={
                  hasActiveFilters
                    ? `${unreadCount} unread matching the current filters`
                    : `${unreadCount} unread`
                }
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={markAllRead}
            >
              Mark all as read
            </button>
            <span className="text-muted-foreground/30 select-none">|</span>
            <button
              className="text-sm text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              onClick={clearAll}
            >
              Clear all
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b px-4 py-2 shrink-0">
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
                key={t.key}
                onClick={() =>
                  updateParams({ filter: t.key === "all" ? null : t.key })
                }
              >
                {t.label}
                {t.key === "unread" && unreadCount > 0 && (
                  <span
                    className={cn(
                      "flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-2xs font-semibold leading-none",
                      active
                        ? "bg-foreground text-background"
                        : "bg-blue-500 text-white"
                    )}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search + filters + pagination — pagination sits inline here (not its
            own row) since SearchInput's flex-1 already pushes everything after
            it to the far right, leaving empty space this reuses. */}
        <div className="flex items-center gap-2 border-b px-4 py-2 shrink-0">
          <SearchInput
            className="h-8 min-w-0 flex-1"
            onChange={(e) => setSearchDraft(e.target.value)}
            onClear={() => setSearchDraft("")}
            placeholder="Search notifications..."
            value={searchDraft}
          />
          {/* Wide column: inline dropdowns */}
          <div className="hidden items-center gap-2 @xl:flex">
            {renderFilters()}
            {hasActiveFilters && (
              <button
                className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={clearFilters}
                type="button"
              >
                Clear
              </button>
            )}
          </div>
          {/* Narrow column (small viewport or open task): a compact Filters
              popover anchored to this button, holding the same dropdowns. */}
          <Popover onOpenChange={setMobileFiltersOpen} open={mobileFiltersOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors @xl:hidden",
                  activeFilterCount > 0
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                type="button"
              >
                <FunnelIcon className="size-3.5" />
                Filters
                {activeFilterCount > 0 && <span>({activeFilterCount})</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              <p className="px-1 pb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Filters
              </p>
              <div className="flex flex-col items-stretch gap-2">
                {renderFilters()}
              </div>
              {hasActiveFilters && (
                <button
                  className="mt-2 w-full border-t pt-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
                  onClick={clearFilters}
                  type="button"
                >
                  Clear all filters
                </button>
              )}
            </PopoverContent>
          </Popover>

          {/* Pagination — Gmail-style "51–100 of 300" + Previous/Next, shown
              only once there's more than one page's worth of results. The
              count text hides below the same @xl breakpoint the filter bar
              collapses at (narrow column, e.g. an open task) — at that width
              there isn't room for both, and the two compact arrow buttons
              alone are still enough to page through. */}
          {totalCount > NOTIFICATIONS_PAGE_SIZE && (
            <div className="ml-auto flex shrink-0 items-center gap-1 @xl:gap-3 border-l pl-3">
              <span className="hidden text-xs text-muted-foreground tabular-nums @xl:inline">
                {pageStart}–{pageEnd} of {totalCount}
              </span>
              <div className="flex items-center gap-1">
                <button
                  aria-label="Previous page"
                  className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  disabled={!canGoPrev || isValidating}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  <CaretLeftIcon className="size-3.5" />
                </button>
                <button
                  aria-label="Next page"
                  className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  disabled={!canGoNext || isValidating}
                  onClick={() => setPage((p) => p + 1)}
                  type="button"
                >
                  <CaretRightIcon className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          {isLoadingInitial && <NotificationSkeletons count={6} />}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-24 gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                {hasActiveFilters
                  ? "No matching notifications"
                  : "No notifications yet."}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasActiveFilters
                  ? "Try adjusting your filters."
                  : "You're all caught up."}
              </p>
            </div>
          )}
          {!isEmpty &&
            groups.map((group) => (
              <section key={group.label}>
                <div className="sticky top-0 z-10 border-b bg-background/95 px-4 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                  {group.label}
                </div>
                {group.items.map((n) => {
                  const isSelected = selectedTask?.notifId === n.id;
                  return (
                    <div
                      className={cn(
                        "group relative flex cursor-pointer items-center gap-3 border-b px-4 py-3.5 transition-colors hover:bg-accent/40",
                        !n.isRead && "bg-blue-50/60 dark:bg-blue-950/20",
                        isSelected && "bg-accent"
                      )}
                      key={n.id}
                      onClick={() => void handleRowClick(n)}
                    >
                      {/* Unread dot */}
                      <div className="w-2 shrink-0 flex justify-center">
                        {!n.isRead && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 block" />
                        )}
                      </div>

                      {/* Avatar */}
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="text-xs bg-muted">
                          {getInitials(n.actorName)}
                        </AvatarFallback>
                      </Avatar>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm leading-snug",
                            n.isRead ? "text-muted-foreground" : "font-medium"
                          )}
                        >
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 text-xs text-muted-foreground truncate italic">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground/70">
                          {n.workspaceName && (
                            <>
                              <span className="flex min-w-0 items-center gap-1 font-medium">
                                <span aria-hidden className="shrink-0">
                                  {n.workspaceIcon ?? "📁"}
                                </span>
                                <span className="truncate">
                                  {n.workspaceName}
                                </span>
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

                      {/* Actions on hover. Overlaid instead of laid out in flow — if they
                    took up space, the text column would shrink on hover and the title
                    would reflow onto extra lines. Icon-only and translucent so the
                    tray stays narrow and reads as floating above the row rather than
                    punching a hole in it. */}
                      <div
                        className={cn(
                          "absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5",
                          "rounded-lg border border-border/60 bg-background/90 p-1 shadow-sm backdrop-blur-sm",
                          "pointer-events-none translate-x-1 opacity-0",
                          "transition-[opacity,transform] duration-150 ease-out",
                          "group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100",
                          "group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100"
                        )}
                      >
                        {getNotificationTarget(n).type !== "info" && (
                          <ActionBtn
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleRowClick(n);
                            }}
                            title="Open"
                          >
                            <ArrowSquareOutIcon className="size-4" />
                          </ActionBtn>
                        )}
                        {n.isRead ? (
                          <ActionBtn
                            onClick={(e) => void markUnread(n.id, e)}
                            title="Mark as unread"
                          >
                            <EnvelopeIcon className="size-4" />
                          </ActionBtn>
                        ) : (
                          <ActionBtn
                            onClick={(e) => void markRead(n.id, e)}
                            title="Mark as read"
                          >
                            <EnvelopeOpenIcon className="size-4" />
                          </ActionBtn>
                        )}
                        <ActionBtn
                          destructive
                          onClick={(e) => void dismiss(n.id, e)}
                          title="Dismiss"
                        >
                          <XIcon className="size-4" />
                        </ActionBtn>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
        </div>
      </div>

      {/* Task detail panel — inline, not a Sheet */}
      {selectedTask && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-end border-b px-3 py-2 shrink-0">
            <button
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              onClick={() => setSelectedTask(null)}
              title="Close"
            >
              <XIcon className="size-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <TaskDetailPanel
              inline
              listId={selectedTask.listId ?? ""}
              onOpenChange={(open) => {
                if (!open) {
                  setSelectedTask(null);
                }
              }}
              open
              spaceId={selectedTask.spaceId}
              taskId={selectedTask.taskId}
              workspaceId={selectedTask.workspaceId}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Square icon-only action. The visible text label was dropped so the hover tray
 * stays narrow enough not to cover the notification title — `title` supplies the
 * tooltip and `aria-label` keeps it accessible.
 */
function ActionBtn({
  onClick,
  title,
  destructive,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={title}
      className={cn(
        "flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        destructive
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-accent hover:text-foreground"
      )}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

/** Lightweight placeholder rows shown while a page is loading. */
function NotificationSkeletons({ count }: { count: number }) {
  return (
    <div aria-hidden>
      {SKELETON_KEYS.slice(0, count).map((k) => (
        <div className="flex items-center gap-3 border-b px-4 py-3.5" key={k}>
          <div className="w-2 shrink-0" />
          <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-2/5 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
