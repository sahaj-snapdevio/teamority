"use client";

import {
  CaretDownIcon,
  CaretRightIcon,
  LightningIcon,
  TrayIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  addTaskToSprint,
  type BacklogList,
  type BacklogTask,
  getBacklogTasks,
  getSprints,
} from "@/app/actions/sprint";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { avatarSrc } from "@/lib/priority-config";
import { setTaskNavContext } from "@/lib/task-nav-context";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type SprintOption = { id: string; name: string; status: string };

const PRIORITY_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  NONE: { label: "—", color: "text-gray-400", icon: "😴" },
  LOW: { label: "Low", color: "text-gray-500", icon: "🦥" },
  MEDIUM: { label: "Medium", color: "text-blue-500", icon: "🔵" },
  HIGH: { label: "High", color: "text-orange-500", icon: "🔶" },
  URGENT: { label: "Urgent", color: "text-red-500", icon: "🔴" },
};

// ─── Task Row ─────────────────────────────────────────────────────────────────

function BacklogTaskRow({
  task,
  workspaceId,
  spaceId,
  sprintId,
  onRefresh,
  taskNavIds,
}: {
  task: BacklogTask;
  workspaceId: string;
  spaceId: string;
  sprintId: string;
  onRefresh: () => void;
  taskNavIds: string[];
}) {
  const router = useRouter();
  const priority =
    PRIORITY_CONFIG[task.priority ?? "NONE"] ?? PRIORITY_CONFIG.NONE;

  const [sprints, setSprints] = React.useState<SprintOption[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [addLoading, setAddLoading] = React.useState(false);

  async function loadSprints() {
    const res = await getSprints(workspaceId, spaceId);
    if ("error" in res) {
      return;
    }
    setSprints(
      res.sprints.filter((s) => s.status === "PLANNED" || s.status === "ACTIVE")
    );
  }

  async function handleAddToSprint(sprintId: string, sprintName: string) {
    setAddLoading(true);
    setAddOpen(false);
    const res = await addTaskToSprint(workspaceId, spaceId, sprintId, task.id);
    setAddLoading(false);
    if (res && "error" in res) {
      toast.error(res.error);
    } else {
      toast.success(`Added to ${sprintName}`);
      onRefresh();
    }
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: row is clickable to open the task, but contains nested interactive controls (Add to Sprint button/popover) — can't be a real <button> (invalid nested-interactive markup)
    <div
      className="group flex items-center gap-3 px-3 py-2 rounded-md hover:bg-base-200/40 cursor-pointer transition-colors"
      onClick={() => {
        setTaskNavContext({ taskIds: taskNavIds });
        router.push(
          `/${workspaceId}/task/${task.id}?from=sprint&sid=${sprintId}`
        );
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) {
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setTaskNavContext({ taskIds: taskNavIds });
          router.push(
            `/${workspaceId}/task/${task.id}?from=sprint&sid=${sprintId}`
          );
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* Status dot */}
      {task.statusColor ? (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full border-2"
          style={{
            borderColor: task.statusColor,
            backgroundColor:
              task.statusType === "CLOSED" ? task.statusColor : "transparent",
          }}
        />
      ) : (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-gray-300" />
      )}

      {/* Title */}
      <span className="flex-1 truncate text-sm">{task.title}</span>

      {/* Seq number */}
      <span className="shrink-0 text-xs text-base-content/60 opacity-0 group-hover:opacity-100 transition-opacity">
        #{task.seqNumber}
      </span>

      {/* Priority */}
      {task.priority && task.priority !== "NONE" && (
        <span
          className={cn(
            "shrink-0 flex items-center gap-1 text-xs font-semibold",
            priority.color
          )}
        >
          <span>{priority.icon}</span>
          <span className="hidden sm:inline">{priority.label}</span>
        </span>
      )}

      {/* Assignees */}
      {task.assignees.length > 0 && (
        <div className="flex -space-x-1.5 shrink-0">
          {task.assignees.slice(0, 3).map((a) => (
            <Avatar className="h-5 w-5 border border-base-100" key={a.userId}>
              {a.image && (
                <AvatarImage alt={a.name ?? a.email ?? ""} src={avatarSrc(a.image)} />
              )}
              <AvatarFallback className="text-[9px]">
                {(a.name ?? a.email ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          {task.assignees.length > 3 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-base-100 bg-base-200 text-[9px] font-medium">
              +{task.assignees.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Add to Sprint */}
      <Popover onOpenChange={setAddOpen} open={addOpen}>
        <PopoverTrigger asChild>
          <Button
            className="shrink-0 h-6 gap-1 px-2 text-xs opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
            disabled={addLoading}
            onClick={(e) => {
              e.stopPropagation();
              void loadSprints();
            }}
            size="sm"
            variant="ghost"
          >
            <LightningIcon className="size-3" />
            Add to Sprint
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-52 p-1"
          onClick={(e) => e.stopPropagation()}
        >
          {sprints.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-base-content/60">
              No active or planned sprints
            </p>
          ) : (
            sprints.map((s) => (
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-base-200 cursor-pointer text-left"
                key={s.id}
                onClick={() => void handleAddToSprint(s.id, s.name)}
                type="button"
              >
                <LightningIcon className="size-3.5 shrink-0 text-violet-500" />
                <span className="truncate">{s.name}</span>
                <span className="ml-auto text-2xs text-base-content/60 capitalize">
                  {s.status.toLowerCase()}
                </span>
              </button>
            ))
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── List Group ───────────────────────────────────────────────────────────────

function BacklogListGroup({
  group,
  workspaceId,
  spaceId,
  sprintId,
  onRefresh,
  taskNavIds,
}: {
  group: BacklogList;
  workspaceId: string;
  spaceId: string;
  sprintId: string;
  onRefresh: () => void;
  taskNavIds: string[];
}) {
  const [open, setOpen] = React.useState(true);

  return (
    <div className="rounded-lg border border-base-300 bg-elevated">
      {/* Header */}
      <button
        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-base-200/30 rounded-t-lg transition-colors"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {open ? (
          <CaretDownIcon className="size-3.5 shrink-0 text-base-content/60" />
        ) : (
          <CaretRightIcon className="size-3.5 shrink-0 text-base-content/60" />
        )}
        <span className="truncate">{group.listName}</span>
        <span className="ml-auto shrink-0 rounded-full bg-base-200 px-2 py-0.5 text-xs text-base-content/60">
          {group.tasks.length}
        </span>
      </button>

      {/* Tasks */}
      {open && (
        <div className="px-1 pb-1 border-t border-base-300">
          {group.tasks.map((task) => (
            <BacklogTaskRow
              key={task.id}
              onRefresh={onRefresh}
              spaceId={spaceId}
              sprintId={sprintId}
              task={task}
              taskNavIds={taskNavIds}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── BacklogView ──────────────────────────────────────────────────────────────

interface BacklogViewProps {
  refreshKey?: number;
  spaceId: string;
  sprintId: string;
  workspaceId: string;
}

export function BacklogView({
  workspaceId,
  spaceId,
  sprintId,
  refreshKey,
}: BacklogViewProps) {
  const [lists, setLists] = React.useState<BacklogList[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [internalRefresh, setInternalRefresh] = React.useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey/internalRefresh aren't read in the body — they're included purely to force a new fetchData identity (and thus a refetch) when an external refresh signal fires.
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const res = await getBacklogTasks(workspaceId, spaceId);
    if ("error" in res) {
      toast.error(res.error);
      setLists([]);
    } else {
      setLists(res.lists);
    }
    setLoading(false);
  }, [workspaceId, spaceId, refreshKey, internalRefresh]);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function handleRefresh() {
    setInternalRefresh((k) => k + 1);
  }

  const totalTasks = lists.reduce((acc, l) => acc + l.tasks.length, 0);
  // Previous/Next Task nav context: each list group top-to-bottom, in the
  // order the backlog renders them — handed to Task Detail so Prev/Next
  // walks it without a DB query.
  const visibleOrderedTaskIds = lists.flatMap((l) => l.tasks.map((t) => t.id));

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrayIcon className="size-4 text-base-content/60" />
        <h2 className="font-semibold text-sm">Backlog</h2>
        {!loading && (
          <span className="rounded-full bg-base-200 px-2 py-0.5 text-xs text-base-content/60">
            {totalTasks}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton className="h-10 w-full rounded-lg" key={i} />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-base-300 py-10 text-center">
          <TrayIcon className="size-8 text-base-content/40" />
          <p className="text-sm text-base-content/60">
            All tasks are in a sprint
          </p>
          <p className="text-xs text-base-content/70">
            Tasks not in any sprint will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map((group) => (
            <BacklogListGroup
              group={group}
              key={group.listId}
              onRefresh={handleRefresh}
              spaceId={spaceId}
              sprintId={sprintId}
              taskNavIds={visibleOrderedTaskIds}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
