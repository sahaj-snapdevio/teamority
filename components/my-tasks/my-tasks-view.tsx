"use client";

import {
  CalendarBlankIcon,
  CaretDownIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ClockIcon,
  FlagIcon,
  SquaresFourIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { format, isPast, isThisWeek, isToday, startOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  getMyTasks,
  type MyTask,
  type MyTasksGroupBy,
} from "@/app/actions/my-tasks";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SearchInput } from "@/components/ui/search-input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MyTasksViewProps {
  workspaceId: string;
}

interface Group {
  accent?: string;
  icon?: React.ReactNode;
  key: string;
  label: string;
  tasks: MyTask[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  URGENT: { label: "Urgent", color: "text-red-500", icon: "🚨" },
  HIGH: { label: "High", color: "text-orange-500", icon: "🏃" },
  MEDIUM: { label: "Medium", color: "text-yellow-500", icon: "🚶" },
  LOW: { label: "Low", color: "text-blue-500", icon: "🦥" },
  NONE: { label: "—", color: "text-muted-foreground/40", icon: "😴" },
} as const;

function formatDue(task: MyTask): { label: string; overdue: boolean } | null {
  const date = task.dueDateEnd ?? task.dueDateStart;
  if (!date) {
    return null;
  }
  const d = new Date(date);
  const overdue = isPast(d) && !isToday(d) && task.status.type !== "CLOSED";
  if (isToday(d)) {
    return { label: "Today", overdue: false };
  }
  if (overdue) {
    return { label: format(d, "MMM d"), overdue: true };
  }
  return { label: format(d, "MMM d"), overdue: false };
}

function groupByDueDate(tasks: MyTask[]): Group[] {
  const today = startOfDay(new Date());

  const overdue: MyTask[] = [];
  const dueToday: MyTask[] = [];
  const thisWeek: MyTask[] = [];
  const upcoming: MyTask[] = [];
  const noDate: MyTask[] = [];

  for (const t of tasks) {
    const date = t.dueDateEnd ?? t.dueDateStart;
    if (!date) {
      noDate.push(t);
      continue;
    }
    const d = startOfDay(new Date(date));
    if (d < today) {
      overdue.push(t);
      continue;
    }
    if (isToday(d)) {
      dueToday.push(t);
      continue;
    }
    if (isThisWeek(d, { weekStartsOn: 1 })) {
      thisWeek.push(t);
      continue;
    }
    upcoming.push(t);
  }

  return [
    {
      key: "overdue",
      label: "Overdue",
      icon: <WarningIcon className="size-3.5 text-red-500" />,
      tasks: overdue,
      accent: "text-red-500",
    },
    {
      key: "today",
      label: "Due Today",
      icon: <ClockIcon className="size-3.5 text-orange-500" />,
      tasks: dueToday,
      accent: "text-orange-500",
    },
    {
      key: "thisWeek",
      label: "Due This Week",
      icon: <CalendarBlankIcon className="size-3.5 text-blue-500" />,
      tasks: thisWeek,
      accent: "text-blue-500",
    },
    {
      key: "upcoming",
      label: "Upcoming",
      icon: <CalendarBlankIcon className="size-3.5 text-muted-foreground" />,
      tasks: upcoming,
    },
    {
      key: "noDate",
      label: "No Due Date",
      icon: <CalendarBlankIcon className="size-3.5 text-muted-foreground/40" />,
      tasks: noDate,
    },
  ].filter((g) => g.tasks.length > 0);
}

function groupByWorkspace(tasks: MyTask[]): Group[] {
  const map = new Map<string, { label: string; tasks: MyTask[] }>();
  for (const t of tasks) {
    const existing = map.get(t.workspace.id);
    if (existing) {
      existing.tasks.push(t);
    } else {
      map.set(t.workspace.id, { label: t.workspace.name, tasks: [t] });
    }
  }
  return Array.from(map.values()).map((g, i) => ({
    key: `ws-${i}`,
    label: g.label,
    tasks: g.tasks,
  }));
}

function groupBySpace(tasks: MyTask[]): Group[] {
  const map = new Map<
    string,
    { label: string; color: string | null; tasks: MyTask[] }
  >();
  for (const t of tasks) {
    const existing = map.get(t.space.id);
    if (existing) {
      existing.tasks.push(t);
    } else {
      map.set(t.space.id, {
        label: t.space.name,
        color: t.space.color,
        tasks: [t],
      });
    }
  }
  return Array.from(map.values()).map((g, i) => ({
    key: `space-${i}`,
    label: g.label,
    tasks: g.tasks,
  }));
}

function groupByList(tasks: MyTask[]): Group[] {
  const map = new Map<
    string,
    { space: string; label: string; tasks: MyTask[] }
  >();
  for (const t of tasks) {
    const existing = map.get(t.list.id);
    if (existing) {
      existing.tasks.push(t);
    } else {
      map.set(t.list.id, {
        space: t.space.name,
        label: t.list.name,
        tasks: [t],
      });
    }
  }
  return Array.from(map.values()).map((g, i) => ({
    key: `list-${i}`,
    label: `${g.space} › ${g.label}`,
    tasks: g.tasks,
  }));
}

function groupByPriority(tasks: MyTask[]): Group[] {
  const order: MyTask["priority"][] = [
    "URGENT",
    "HIGH",
    "MEDIUM",
    "LOW",
    "NONE",
  ];
  const map = new Map<string, MyTask[]>();
  for (const p of order) {
    map.set(p, []);
  }
  for (const t of tasks) {
    map.get(t.priority)?.push(t);
  }
  return order
    .filter((p) => (map.get(p)?.length ?? 0) > 0)
    .map((p) => {
      const cfg = PRIORITY_CONFIG[p];
      return {
        key: p,
        label: cfg.label,
        icon: <span className="mr-1">{cfg.icon}</span>,
        tasks: map.get(p) ?? [],
      };
    });
}

function groupByStatus(tasks: MyTask[]): Group[] {
  const map = new Map<
    string,
    { label: string; color: string; tasks: MyTask[] }
  >();
  for (const t of tasks) {
    const existing = map.get(t.status.id);
    if (existing) {
      existing.tasks.push(t);
    } else {
      map.set(t.status.id, {
        label: t.status.name,
        color: t.status.color,
        tasks: [t],
      });
    }
  }
  return Array.from(map.values()).map((g, i) => ({
    key: `status-${i}`,
    label: g.label,
    tasks: g.tasks,
  }));
}

function buildGroups(tasks: MyTask[], groupBy: MyTasksGroupBy): Group[] {
  switch (groupBy) {
    case "due_date":
      return groupByDueDate(tasks);
    case "workspace":
      return groupByWorkspace(tasks);
    case "space":
      return groupBySpace(tasks);
    case "list":
      return groupByList(tasks);
    case "priority":
      return groupByPriority(tasks);
    case "status":
      return groupByStatus(tasks);
  }
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: MyTask }) {
  const router = useRouter();
  const priority = PRIORITY_CONFIG[task.priority];
  const due = formatDue(task);
  const titleRef = React.useRef<HTMLSpanElement>(null);
  const [titleTruncated, setTitleTruncated] = React.useState(false);

  // Only offer the hover tooltip when the title is actually clipped —
  // comparing scrollWidth (full content width) against clientWidth (visible
  // width) is the standard way to detect that. Re-checked on window resize
  // since the fixed-width Task column's available space changes with it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: task.title drives a DOM re-measure, not read directly in the body
  React.useEffect(() => {
    function checkTruncation() {
      const el = titleRef.current;
      setTitleTruncated(!!el && el.scrollWidth > el.clientWidth);
    }
    checkTruncation();
    window.addEventListener("resize", checkTruncation);
    return () => window.removeEventListener("resize", checkTruncation);
  }, [task.title]);

  return (
    <tr
      className="group/row border-b border-border/40 hover:bg-accent/30 cursor-pointer transition-colors"
      onClick={() => router.push(`/${task.workspace.id}/task/${task.id}`)}
    >
      {/* Title + breadcrumb — max-w-xl caps how wide the text gets even on
          very wide screens, so titles ellipsize at a consistent length
          instead of stretching to fill however much space table-fixed
          happens to leave for this column. min-w-0 has to cascade through
          every flex ancestor down to the truncating spans, or their default
          flex-item min-width:auto keeps them at their full intrinsic width
          and the ellipsis never engages. */}
      <td className="py-2.5 pl-10 pr-4">
        <div className="flex min-w-0 max-w-xl flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xs text-muted-foreground/50 font-mono shrink-0 w-6">
              #{task.seqNumber}
            </span>
            {titleTruncated ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="min-w-0 flex-1 truncate text-[15px] font-medium"
                      ref={titleRef}
                    >
                      {task.title}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm" side="top">
                    <p>{task.title}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <span
                className="min-w-0 flex-1 truncate text-[15px] font-medium"
                ref={titleRef}
              >
                {task.title}
              </span>
            )}
          </div>
          <span className="pl-8 text-xs text-muted-foreground/60 truncate">
            <span className="font-medium text-muted-foreground/80">
              {task.workspace.name}
            </span>
            {" › "}
            {task.space.name} › {task.list.name}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="py-2.5 px-4 w-32">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: `${task.status.color}18`,
            color: task.status.color,
          }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: task.status.color }}
          />
          {task.status.name}
        </span>
      </td>

      {/* Due date */}
      <td className="py-2.5 px-4 w-28">
        {due ? (
          <span
            className={cn(
              "text-sm font-medium",
              due.overdue ? "text-red-500" : "text-muted-foreground"
            )}
          >
            {due.label}
          </span>
        ) : (
          <CalendarBlankIcon className="size-4 text-muted-foreground/30" />
        )}
      </td>

      {/* Priority */}
      <td className="py-2.5 px-4 w-28">
        {task.priority === "NONE" ? (
          <FlagIcon className="size-4 text-muted-foreground/30" />
        ) : (
          <span
            className={cn(
              "flex items-center gap-1 text-sm font-medium",
              priority.color
            )}
          >
            <span>{priority.icon}</span>
            {priority.label}
          </span>
        )}
      </td>
    </tr>
  );
}

// ─── Task group ───────────────────────────────────────────────────────────────

function TaskGroup({ group }: { group: Group }) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <>
      <tr className="bg-muted/20">
        <td className="py-2 pl-4 pr-3" colSpan={4}>
          <button
            className="flex items-center gap-2 select-none"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? (
              <CaretRightIcon className="size-3.5 text-muted-foreground shrink-0" />
            ) : (
              <CaretDownIcon className="size-3.5 text-muted-foreground shrink-0" />
            )}
            {group.icon}
            <span className={cn("text-sm font-semibold", group.accent)}>
              {group.label}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {group.tasks.length}
            </span>
          </button>
        </td>
      </tr>
      {!collapsed && group.tasks.map((t) => <TaskRow key={t.id} task={t} />)}
    </>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

const GROUP_BY_OPTIONS: { value: MyTasksGroupBy; label: string }[] = [
  { value: "due_date", label: "Due Date" },
  { value: "workspace", label: "Workspace" },
  { value: "space", label: "Space" },
  { value: "list", label: "List" },
  { value: "priority", label: "Priority" },
  { value: "status", label: "Status" },
];

export function MyTasksView(_props: MyTasksViewProps) {
  const [tasks, setTasks] = React.useState<MyTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [groupBy, setGroupBy] = React.useState<MyTasksGroupBy>("due_date");
  const [showCompleted, setShowCompleted] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const fetchTasks = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyTasks({ showCompleted });
      if ("error" in res) {
        return;
      }
      setTasks(res.tasks);
    } finally {
      setLoading(false);
    }
  }, [showCompleted]);

  React.useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const filtered = search.trim()
    ? tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
    : tasks;

  const groups = buildGroups(filtered, groupBy);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <CheckCircleIcon className="size-5 text-primary" weight="fill" />
          <h1 className="text-lg font-semibold">My Tasks</h1>
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">
          {loading
            ? "…"
            : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <SearchInput
          className="w-48 focus:w-64"
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          placeholder="Search tasks…"
          value={search}
        />

        {/* Group by */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 h-8 rounded-lg border border-border px-3 text-xs font-semibold text-foreground/70 hover:bg-accent/30 transition-colors cursor-pointer select-none">
              <SquaresFourIcon className="size-3.5 text-gray-500" />
              Group By:{" "}
              {GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-44 p-1 flex flex-col gap-0.5"
          >
            {GROUP_BY_OPTIONS.map((o) => (
              <button
                className={cn(
                  "px-2 py-1.5 text-xs font-semibold text-left rounded hover:bg-accent/30 cursor-pointer",
                  groupBy === o.value && "bg-accent text-foreground"
                )}
                key={o.value}
                onClick={() => setGroupBy(o.value)}
              >
                {o.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Show completed */}
        {/* <button
          onClick={() => setShowCompleted((v) => !v)}
          className={cn(
            "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
            showCompleted
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          {showCompleted ? "Hide Completed" : "Show Completed"}
        </button> */}
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border bg-card overflow-hidden animate-pulse">
          <div className="h-10 bg-muted/40 border-b" />
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div className="h-10 rounded bg-muted" key={i} />
            ))}
          </div>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border bg-card flex flex-col items-center gap-3 py-20 text-center">
          <CheckCircleIcon
            className="size-10 text-muted-foreground/20"
            weight="fill"
          />
          <p className="text-sm font-medium text-muted-foreground">
            {search
              ? "No tasks match your search"
              : showCompleted
                ? "No tasks assigned to you"
                : "You're all caught up!"}
          </p>
          {!showCompleted && tasks.length === 0 && (
            <p className="text-xs text-muted-foreground/60">
              Tasks assigned to you will appear here
            </p>
          )}
          {!showCompleted &&
            tasks.length > 0 &&
            filtered.length === 0 &&
            search && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setSearch("")}
              >
                Clear search
              </button>
            )}
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* table-fixed is what makes the explicit column widths below
              actually binding — without it, a long unbroken task title can
              force the Task column (and the whole table) wider than its
              container, pushing Status/Due Date/Priority out of alignment. */}
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20">
                <th className="py-2 pl-10 pr-4 text-left text-sm font-semibold text-muted-foreground">
                  Task
                </th>
                <th className="py-2 px-4 text-left text-sm font-semibold text-muted-foreground w-32">
                  Status
                </th>
                <th className="py-2 px-4 text-left text-sm font-semibold text-muted-foreground w-28">
                  Due Date
                </th>
                <th className="py-2 px-4 text-left text-sm font-semibold text-muted-foreground w-28">
                  Priority
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, i) => (
                <React.Fragment key={group.key}>
                  {i > 0 && (
                    <tr aria-hidden>
                      <td
                        className="h-2 bg-transparent border-none"
                        colSpan={4}
                      />
                    </tr>
                  )}
                  <TaskGroup group={group} />
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
