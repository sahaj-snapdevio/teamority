"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  ArrowsDownUpIcon,
  ArrowSquareOutIcon,
  CheckCircleIcon,
  CopyIcon,
  DotsThreeIcon,
  HashIcon,
  LinkIcon,
  ListPlusIcon,
  PlusIcon,
  TextAaIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { SearchInput } from "@/components/ui/search-input";
import {
  archiveTask,
  createSubtask,
  deleteTask,
  duplicateTask,
  reorderTasksInStatus,
  unarchiveTask,
  updateTask,
  updateTaskStatus,
} from "@/app/actions/task";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CreateTaskModal } from "@/components/task/create-task-modal";
import { useRealtimePause } from "@/components/realtime/realtime-provider";
import { FacetFilter } from "@/components/filters/facet-filter";
import { PRIORITY_OPTIONS } from "@/lib/filters/options";
import { STATUS_PRESET_COLORS } from "@/lib/status-colors";
import { createListStatus } from "@/app/actions/list";
import { toastWithUndo } from "@/lib/undo-toast";
import { taskUrl } from "@/lib/app-url";
import { cn } from "@/lib/utils";
import { QuickCreateTask } from "./quick-create-task";

function userInitials(name: string) {
  if (!name) return "?";
  const clean = name.includes("@") ? name.split("@")[0] : name;
  return clean.split(/[\s._-]+/).map((n) => n[0]).filter(Boolean).join("").toUpperCase().slice(0, 2) || "?";
}

function avatarSrc(key: string | null | undefined): string | undefined {
  return key ? `/api/files/${key}` : undefined;
}

interface Status {
  id: string;
  name: string;
  color: string;
  type: "OPEN" | "ACTIVE" | "CLOSED";
  orderIndex: number;
}

interface Task {
  id: string;
  title: string;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  statusId: string | null;
  seqNumber: number;
  orderIndex: number;
  tags: { id: string; name: string; color: string }[];
  assignees: { userId: string; name: string; image: string | null }[];
}

interface BoardViewProps {
  workspaceId: string;
  space: { id: string; name: string; color: string | null };
  list: { id: string; name: string; color?: string | null; description?: string | null };
  statuses: Status[];
  tasks: Task[];
  headerless?: boolean;
  canEdit?: boolean;
  canManage?: boolean;
  isAdmin?: boolean;
  members?: { userId: string; name: string | null; email: string | null }[];
  tags?: { id: string; name: string; color: string }[];
}

const PRIORITY_ORDER: Record<Task["priority"], number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  NONE: 4,
};

const PRIORITY_CONFIG: Record<Task["priority"], { label: string; color: string; icon: string }> = {
  NONE:   { label: "No Priority", color: "text-muted-foreground", icon: "😴" },
  LOW:    { label: "Low",         color: "text-muted-foreground", icon: "🦥" },
  MEDIUM: { label: "Medium",      color: "text-yellow-600",       icon: "🚶" },
  HIGH:   { label: "High",        color: "text-orange-500",       icon: "🏃" },
  URGENT: { label: "Urgent",      color: "text-red-500",          icon: "🚨" },
};

// ─── Card visual (no dnd hooks) ──────────────────────────────────────────────

function CardContent({
  task,
  overlay = false,
  isDragging = false,
  dragListeners,
  workspaceId,
  spaceId,
  listId,
  statuses,
  canEdit,
  isAdmin,
  onRefresh,
}: {
  task: Task;
  overlay?: boolean;
  isDragging?: boolean;
  dragListeners?: React.HTMLAttributes<HTMLDivElement>;
  workspaceId?: string;
  spaceId?: string;
  listId?: string;
  statuses?: Status[];
  canEdit?: boolean;
  isAdmin?: boolean;
  onRefresh?: () => void;
}) {
  // The hover quick-actions render only on real (non-overlay) cards that were
  // handed the workspace/list context. The drag overlay stays purely visual.
  const interactive =
    !overlay && !!workspaceId && !!spaceId && !!listId && !!onRefresh;

  // Inline rename — mirrors the list-row flow (updateTask({ title })).
  const [localTitle, setLocalTitle] = React.useState(task.title);
  const [renaming, setRenaming] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(task.title);
  React.useEffect(() => { setLocalTitle(task.title); }, [task.title]);

  // Show a tooltip with the full title only when it's actually clipped by the
  // 2-line clamp (vertical) or an unbreakable word (horizontal).
  const titleRef = React.useRef<HTMLParagraphElement>(null);
  const [titleTruncated, setTitleTruncated] = React.useState(false);
  React.useEffect(() => {
    const el = titleRef.current;
    setTitleTruncated(
      el
        ? el.scrollHeight > el.clientHeight + 1 ||
            el.scrollWidth > el.clientWidth + 1
        : false,
    );
  }, [localTitle]);

  // Add-subtask mini composer + delete confirm.
  const [subtaskOpen, setSubtaskOpen] = React.useState(false);
  const [subtaskTitle, setSubtaskTitle] = React.useState("");
  const [creatingSubtask, setCreatingSubtask] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  function startRename() {
    if (!canEdit) return;
    setTitleDraft(localTitle);
    setRenaming(true);
  }
  function cancelRename() {
    setRenaming(false);
  }
  async function commitRename() {
    const trimmed = titleDraft.trim();
    setRenaming(false);
    // Empty or unchanged after trim → keep the old title, no request.
    if (!trimmed || trimmed === localTitle) return;
    setLocalTitle(trimmed); // optimistic
    const res = await updateTask(workspaceId!, spaceId!, listId ?? null, task.id, { title: trimmed });
    if (res && "error" in res) {
      setLocalTitle(task.title); // revert
      toast.error(res.error);
      return;
    }
    onRefresh?.();
  }

  // Completion is status-driven: "complete" == current status type CLOSED.
  const currentStatus = statuses?.find((s) => s.id === task.statusId);
  const isDone = currentStatus?.type === "CLOSED";
  const doneStatus = statuses?.find((s) => s.type === "CLOSED");
  const openStatus =
    statuses?.find((s) => s.type === "OPEN") ??
    statuses?.find((s) => s.type === "ACTIVE");
  const completeTarget = isDone ? openStatus : doneStatus;

  async function toggleComplete() {
    if (!completeTarget) return;
    const res = await updateTaskStatus(workspaceId!, spaceId!, listId ?? null, task.id, completeTarget.id);
    if (res && "error" in res) {
      toast.error(res.error);
      return;
    }
    onRefresh?.();
  }

  async function addSubtask() {
    const trimmed = subtaskTitle.trim();
    if (!trimmed || creatingSubtask) return;
    setCreatingSubtask(true);
    const res = await createSubtask(workspaceId!, spaceId!, task.id, trimmed);
    setCreatingSubtask(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setSubtaskTitle("");
    setSubtaskOpen(false);
    toast.success("Subtask added");
    onRefresh?.();
  }

  async function handleDuplicate() {
    const res = await duplicateTask(workspaceId!, spaceId!, listId ?? null, task.id);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    onRefresh?.();
  }
  async function handleArchive() {
    await archiveTask(workspaceId!, spaceId!, listId ?? null, task.id);
    onRefresh?.();
    toastWithUndo("Task archived", async () => {
      await unarchiveTask(workspaceId!, spaceId!, listId ?? null, task.id);
      onRefresh?.();
    });
  }
  async function confirmDelete() {
    setDeleting(true);
    await deleteTask(workspaceId!, spaceId!, listId ?? null, task.id);
    setDeleting(false);
    setDeleteOpen(false);
    onRefresh?.();
  }
  async function copyTaskLink() {
    try {
      await navigator.clipboard.writeText(taskUrl(workspaceId!, task.id));
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }
  async function copyTaskId() {
    try {
      await navigator.clipboard.writeText(task.id);
      toast.success("Task ID copied");
    } catch {
      toast.error("Couldn't copy ID");
    }
  }

  const iconBtn =
    "flex size-6 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const menuItem =
    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-semibold hover:bg-accent text-left cursor-pointer";

  return (
    <div
      className={cn(
        "relative rounded-lg border bg-card p-3 shadow-sm group/card",
        isDragging && "opacity-40 shadow-none border-dashed",
        overlay && "shadow-xl rotate-1 cursor-grabbing",
        !isDragging && !overlay && "hover:shadow-md transition-shadow",
      )}
    >
      <div {...dragListeners} className={cn(!overlay && "cursor-grab active:cursor-grabbing")}>
        {renaming ? (
          <input
            autoFocus
            className="w-full rounded-md border border-input bg-background px-1.5 py-0.5 text-[13px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                void commitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelRename();
              }
            }}
            onBlur={() => void commitRename()}
          />
        ) : titleTruncated && !overlay ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <p ref={titleRef} className="text-[13px] font-medium text-foreground leading-snug select-none line-clamp-2">{localTitle}</p>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <span className="block min-w-0 whitespace-normal break-words text-center">
                {localTitle}
              </span>
            </TooltipContent>
          </Tooltip>
        ) : (
          <p ref={titleRef} className="text-[13px] font-medium text-foreground leading-snug select-none line-clamp-2">{localTitle}</p>
        )}
        {task.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full px-1.5 py-0.5 text-2xs font-medium"
                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-mono text-2xs text-muted-foreground shrink-0">#{task.seqNumber}</span>
          <div className="flex items-center gap-2 min-w-0">
            {task.priority !== "NONE" && (() => {
              const cfg = PRIORITY_CONFIG[task.priority];
              return cfg ? (
                <span className={cn("flex items-center gap-1 text-xs font-bold shrink-0", cfg.color)}>
                  <span>{cfg.icon}</span>
                  {cfg.label}
                </span>
              ) : null;
            })()}
            {task.assignees.length > 0 && (
              <div className="flex -space-x-1.5 ml-auto">
                {task.assignees.slice(0, 3).map((a) => (
                  <Avatar key={a.userId} className="size-7 border-2 border-background" title={a.name}>
                    {a.image && <AvatarImage src={avatarSrc(a.image)} alt={a.name} />}
                    <AvatarFallback className="text-xs font-semibold bg-primary text-primary-foreground">
                      {userInitials(a.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {task.assignees.length > 3 && (
                  <div className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground">
                    +{task.assignees.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hover quick actions — sibling of the drag/click div above, so it starts
          neither a drag nor a task-open. Revealed by CSS on card hover, keyboard
          focus-within, or while one of its menus is open (data-state=open).
          pointer-events-none while hidden so taps pass through to open the task.
          Hidden entirely while renaming so it doesn't overlap the title input. */}
      {interactive && !renaming && (
        <div className="pointer-events-none absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 rounded-md border bg-card/95 p-0.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-150 group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-focus-within/card:pointer-events-auto group-focus-within/card:opacity-100 has-[[data-state=open]]:pointer-events-auto has-[[data-state=open]]:opacity-100">
          {canEdit && completeTarget && (
            <button
              type="button"
              title={isDone ? "Reopen" : "Complete"}
              className={iconBtn}
              onClick={() => void toggleComplete()}
            >
              {isDone ? (
                <ArrowCounterClockwiseIcon className="size-4" />
              ) : (
                <CheckCircleIcon className="size-4" />
              )}
            </button>
          )}
          {canEdit && (
            <Popover
              open={subtaskOpen}
              onOpenChange={(o) => {
                setSubtaskOpen(o);
                if (!o) setSubtaskTitle("");
              }}
            >
              <PopoverTrigger asChild>
                <button type="button" title="Add subtask" className={iconBtn}>
                  <ListPlusIcon className="size-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 rounded-xl p-2">
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    placeholder="Subtask name…"
                    className="h-8 rounded-md text-xs"
                    value={subtaskTitle}
                    disabled={creatingSubtask}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addSubtask();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8 shrink-0 rounded-md px-3 text-xs font-semibold"
                    disabled={creatingSubtask || !subtaskTitle.trim()}
                    onClick={() => void addSubtask()}
                  >
                    Add
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
          {canEdit && (
            <button type="button" title="Rename" className={iconBtn} onClick={startRename}>
              <TextAaIcon className="size-4" />
            </button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" title="More" className={iconBtn}>
                <DotsThreeIcon className="size-4.5" weight="bold" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 rounded-xl p-1">
              <button type="button" className={menuItem} onClick={() => void copyTaskLink()}>
                <LinkIcon className="size-3.5 text-muted-foreground" /> Copy task link
              </button>
              <a
                href={taskUrl(workspaceId!, task.id)}
                target="_blank"
                rel="noopener noreferrer"
                className={menuItem}
              >
                <ArrowSquareOutIcon className="size-3.5 text-muted-foreground" /> Open in new tab
              </a>
              <button type="button" className={menuItem} onClick={() => void copyTaskId()}>
                <HashIcon className="size-3.5 text-muted-foreground" /> Copy task ID
              </button>
              {canEdit && (
                <>
                  <div className="h-px bg-border my-1" />
                  <button type="button" className={menuItem} onClick={() => void handleDuplicate()}>
                    <CopyIcon className="size-3.5 text-muted-foreground" /> Duplicate
                  </button>
                  <button type="button" className={menuItem} onClick={() => void handleArchive()}>
                    <ArchiveIcon className="size-3.5 text-muted-foreground" /> Archive
                  </button>
                </>
              )}
              {isAdmin && (
                <button
                  type="button"
                  className={cn(menuItem, "text-red-600 hover:bg-red-50 hover:text-red-700")}
                  onClick={() => setDeleteOpen(true)}
                >
                  <TrashIcon className="size-3.5" /> Delete
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      )}

      {interactive && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="rounded-xl sm:max-w-sm">
            <DialogTitle className="sr-only">Delete task</DialogTitle>
            <div className="flex flex-col items-center gap-3 pt-2 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-red-100">
                <TrashIcon className="size-6 text-red-600" />
              </div>
              <div>
                <p className="text-base font-semibold">Delete task?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  “{localTitle}” will be permanently deleted. This can’t be undone.
                </p>
              </div>
              <div className="mt-2 flex w-full gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-md"
                  disabled={deleting}
                  onClick={() => setDeleteOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 rounded-md"
                  disabled={deleting}
                  onClick={() => void confirmDelete()}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Sortable task card ───────────────────────────────────────────────────────

function TaskCard({
  task,
  workspaceId,
  spaceId,
  listId,
  statuses,
  canEdit,
  isAdmin,
  onRefresh,
}: {
  task: Task;
  workspaceId: string;
  spaceId: string;
  listId: string;
  statuses: Status[];
  canEdit?: boolean;
  isAdmin?: boolean;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", statusId: task.statusId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Wrap listeners to allow click-through when not dragging
  const clickableListeners = {
    ...listeners,
    onClick: (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) {
        e.stopPropagation();
        router.push(`/${workspaceId}/task/${task.id}?from=board`);
      }
    },
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <CardContent
        task={task}
        isDragging={isDragging}
        dragListeners={clickableListeners}
        workspaceId={workspaceId}
        spaceId={spaceId}
        listId={listId}
        statuses={statuses}
        canEdit={canEdit}
        isAdmin={isAdmin}
        onRefresh={onRefresh}
      />
    </div>
  );
}

// ─── Column (droppable) ───────────────────────────────────────────────────────

function Column({
  status,
  tasks,
  workspaceId,
  space,
  list,
  statuses,
  canEdit,
  isAdmin,
  onRefresh,
}: {
  status: Status;
  tasks: Task[];
  workspaceId: string;
  space: BoardViewProps["space"];
  list: BoardViewProps["list"];
  statuses: Status[];
  canEdit?: boolean;
  isAdmin?: boolean;
  onRefresh: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <div
      className="flex w-64 shrink-0 flex-col rounded-xl p-2 gap-2 max-h-[calc(100vh-11rem)]"
      style={{ backgroundColor: `${status.color}14` }}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-1 py-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
        <span className="flex-1 font-semibold text-sm uppercase tracking-wide text-foreground/80">{status.name}</span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: `${status.color}22`, color: status.color }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Droppable task list — flex-1 + overflow-y-auto gives each column its own scroll */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex flex-col gap-2 rounded-lg p-1 transition-all flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
            tasks.length === 0 && "min-h-8",
          )}
          style={isOver ? { boxShadow: `inset 0 0 0 2px ${status.color}` } : undefined}
        >
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              workspaceId={workspaceId}
              spaceId={space.id}
              listId={list.id}
              statuses={statuses}
              canEdit={canEdit}
              isAdmin={isAdmin}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      </SortableContext>

      <QuickCreateTask
        workspaceId={workspaceId}
        spaceId={space.id}
        listId={list.id}
        statusId={status.id}
        placeholder="Add task"
      />
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function BoardView({ workspaceId, space, list, statuses, tasks, members = [], canEdit, canManage, isAdmin }: BoardViewProps) {
  const router = useRouter();
  // Re-pull the server-rendered board after a card quick-action. The actions
  // revalidate + broadcast server-side; this refreshes the current view too.
  const handleRefresh = React.useCallback(() => router.refresh(), [router]);

  // ── "Add group" — create a new status column (reuses createListStatus). ────
  const [newGroupOpen, setNewGroupOpen] = React.useState(false);
  const [newGroupName, setNewGroupName] = React.useState("");
  const [newGroupColor, setNewGroupColor] = React.useState("#6B7280");
  const [creatingGroup, setCreatingGroup] = React.useState(false);

  async function handleCreateGroup() {
    const name = newGroupName.trim();
    if (!name || creatingGroup) return;
    setCreatingGroup(true);
    const res = await createListStatus(workspaceId, space.id, list.id, {
      name,
      color: newGroupColor,
      type: "OPEN",
    });
    setCreatingGroup(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setNewGroupName("");
    setNewGroupColor("#6B7280");
    setNewGroupOpen(false);
    handleRefresh();
  }

  // Local task state for optimistic drag updates
  const [localTasks, setLocalTasks] = React.useState<Task[]>(tasks);
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);

  // Sync when server data changes
  React.useEffect(() => { setLocalTasks(tasks); }, [tasks]);

  // ── Toolbar state ─────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<"name" | "priority" | null>(null);
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");

  // Local filter state (mirrors list-view pattern)
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = React.useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = React.useState<string[]>([]);

  // ── Filtered + sorted tasks (for display) ────────────────────────────────
  const processedTasks = React.useMemo(() => {
    let result = localTasks.filter((t) => {
      if (searchQuery.trim() && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (statusFilter.length && !statusFilter.includes(t.statusId ?? "")) return false;
      if (priorityFilter.length && !priorityFilter.includes(t.priority)) return false;
      if (assigneeFilter.length) {
        const hasUnassigned = assigneeFilter.includes("unassigned");
        const userIds = assigneeFilter.filter((a) => a !== "unassigned");
        const assigneeIds = t.assignees.map((a) => a.userId);
        const matchUnassigned = hasUnassigned && assigneeIds.length === 0;
        const matchUser = userIds.length > 0 && assigneeIds.some((id) => userIds.includes(id));
        if (!matchUnassigned && !matchUser) return false;
      }
      return true;
    });

    if (sortBy === "name") {
      result = [...result].sort((a, b) =>
        sortOrder === "asc" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title),
      );
    } else if (sortBy === "priority") {
      result = [...result].sort((a, b) => {
        const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        return sortOrder === "asc" ? diff : -diff;
      });
    }

    return result;
  }, [localTasks, searchQuery, statusFilter, priorityFilter, assigneeFilter, sortBy, sortOrder]);

  // tasksByStatus uses processed tasks for display; DnD handlers still use localTasks
  const tasksByStatus = React.useMemo(() => {
    const map: Record<string, Task[]> = Object.fromEntries(statuses.map((s) => [s.id, []]));
    for (const t of processedTasks) {
      if (t.statusId && map[t.statusId]) map[t.statusId].push(t);
    }
    return map;
  }, [processedTasks, statuses]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function findStatusForTask(taskId: string) {
    return localTasks.find((t) => t.id === taskId)?.statusId ?? null;
  }

  // Pause live auto-refresh while dragging so it can't clobber the drag.
  const pauseRealtime = useRealtimePause();
  const dragResumeRef = React.useRef<null | (() => void)>(null);
  const endDrag = React.useCallback(() => {
    dragResumeRef.current?.();
    dragResumeRef.current = null;
  }, []);

  function onDragStart({ active }: DragStartEvent) {
    endDrag();
    dragResumeRef.current = pauseRealtime();
    setActiveTask(localTasks.find((t) => t.id === active.id) ?? null);
  }

  function onDragCancel() {
    setActiveTask(null);
    endDrag();
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeStatus = findStatusForTask(activeId);
    // over could be a column (statusId) or another task
    const overStatus = statuses.find((s) => s.id === overId)?.id
      ?? findStatusForTask(overId);

    if (!activeStatus || !overStatus) return;

    if (activeStatus === overStatus) {
      // Same column — reorder positions optimistically
      setLocalTasks((prev) => {
        const oldIndex = prev.findIndex((t) => t.id === activeId);
        const newIndex = prev.findIndex((t) => t.id === overId);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    } else {
      // Cross-column — move task to new column
      setLocalTasks((prev) =>
        prev.map((t) => t.id === activeId ? { ...t, statusId: overStatus } : t),
      );
    }
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    endDrag();
    if (!over) return;

    const activeId = active.id as string;
    const finalStatus = findStatusForTask(activeId); // from localTasks after all onDragOver updates
    const originalStatus = tasks.find((t) => t.id === activeId)?.statusId;

    if (!finalStatus) return;

    if (finalStatus === originalStatus) {
      // Same column — persist new card order
      const columnTaskIds = localTasks
        .filter((t) => t.statusId === finalStatus)
        .map((t) => t.id);
      const originalIds = tasks
        .filter((t) => t.statusId === originalStatus)
        .map((t) => t.id);
      if (columnTaskIds.join(",") === originalIds.join(",")) return; // no change
      const res = await reorderTasksInStatus(workspaceId, space.id, list.id, columnTaskIds);
      if ("error" in res) setLocalTasks(tasks);
    } else {
      // Cross-column — update status
      const res = await updateTaskStatus(workspaceId, space.id, list.id, activeId, finalStatus);
      if ("error" in res) setLocalTasks(tasks);
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <CreateTaskModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
        spaceId={space.id}
        listId={list.id}
        statuses={statuses}
        canManage={canEdit || isAdmin}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <SearchInput
            placeholder="Search tasks…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            className="w-44 focus:w-56"
          />

          {/* Filters — shared facet controls (same state + filter logic) */}
          <FacetFilter
            label="Status"
            options={statuses.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
          <FacetFilter
            label="Priority"
            options={PRIORITY_OPTIONS}
            selected={priorityFilter}
            onChange={setPriorityFilter}
          />
          {members.length > 0 && (
            <FacetFilter
              label="Assignee"
              searchable
              options={[
                { value: "unassigned", label: "Unassigned" },
                ...members.map((m) => ({
                  value: m.userId,
                  label: m.name || m.email || "Unknown",
                })),
              ]}
              selected={assigneeFilter}
              onChange={setAssigneeFilter}
            />
          )}

          {/* Sort */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 h-8 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer select-none">
                <ArrowsDownUpIcon className="size-3.5" />
                Sort: {sortBy ? (sortBy.charAt(0).toUpperCase() + sortBy.slice(1)) : "None"}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-44 p-1 flex flex-col gap-0.5">
              <button onClick={() => setSortBy(null)} className={cn("px-2 py-1.5 text-xs font-semibold text-left rounded hover:bg-accent cursor-pointer text-foreground", !sortBy && "bg-accent")}>None</button>
              <button onClick={() => { setSortBy("name"); setSortOrder((o) => o === "asc" ? "desc" : "asc"); }} className={cn("px-2 py-1.5 text-xs font-semibold text-left rounded hover:bg-accent cursor-pointer text-foreground", sortBy === "name" && "bg-accent")}>Task Name</button>
              <button onClick={() => { setSortBy("priority"); setSortOrder((o) => o === "asc" ? "desc" : "asc"); }} className={cn("px-2 py-1.5 text-xs font-semibold text-left rounded hover:bg-accent cursor-pointer text-foreground", sortBy === "priority" && "bg-accent")}>Priority</button>
            </PopoverContent>
          </Popover>
        </div>

        {/* Create Task button */}
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-all shadow-sm shrink-0 cursor-pointer select-none"
        >
          <PlusIcon className="size-3.5" weight="bold" />
          Create Task
        </button>
      </div>

      <DndContext
        id="board-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 items-start">
          {statuses.map((status) => (
            <Column
              key={status.id}
              status={status}
              tasks={tasksByStatus[status.id] ?? []}
              workspaceId={workspaceId}
              space={space}
              list={list}
              statuses={statuses}
              canEdit={canEdit}
              isAdmin={isAdmin}
              onRefresh={handleRefresh}
            />
          ))}

          {/* Add group — creates a new status column (Full Access only). */}
          {canManage && (
            <button
              type="button"
              onClick={() => setNewGroupOpen(true)}
              className="flex h-9 shrink-0 select-none items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
            >
              <PlusIcon className="size-4" weight="bold" /> Add group
            </button>
          )}
        </div>

        {/* Drag overlay — shown while dragging */}
        <DragOverlay>
          {activeTask && <CardContent task={activeTask} overlay />}
        </DragOverlay>
      </DndContext>

      {/* New group (status) dialog — mirrors the List view's New Status dialog. */}
      {canManage && (
        <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
          <DialogContent className="rounded-xl sm:max-w-xs">
            <DialogTitle className="text-sm font-bold">New Group</DialogTitle>
            <div className="space-y-3">
              <Input
                autoFocus
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateGroup();
                }}
                className="h-9 text-xs"
              />
              <div className="flex flex-wrap gap-2">
                {STATUS_PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewGroupColor(color)}
                    className={cn(
                      "size-6 cursor-pointer rounded-full transition-transform",
                      newGroupColor === color &&
                        "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-popover",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                className="h-8 text-xs font-semibold"
                onClick={() => setNewGroupOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="h-8 text-xs font-bold"
                disabled={creatingGroup || !newGroupName.trim()}
                onClick={() => void handleCreateGroup()}
              >
                {creatingGroup ? "Creating…" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </TooltipProvider>
  );
}
