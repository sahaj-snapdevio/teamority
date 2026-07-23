"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  ArrowSquareOutIcon,
  ArrowsDownUpIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  CheckCircleIcon,
  CheckSquareIcon,
  CopyIcon,
  DotsThreeIcon,
  HashIcon,
  LinkIcon,
  ListPlusIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  TextAaIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import type { CustomFieldRow } from "@/app/actions/custom-field";
import { createListStatus } from "@/app/actions/list";
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
import { ManageFieldsIcon } from "@/components/common/manage-fields-icon";
import { CustomFieldFilterControl } from "@/components/filters/custom-field-filter";
import {
  FacetFilter,
  FacetOptionList,
} from "@/components/filters/facet-filter";
import { FilterBuilder } from "@/components/filters/filter-builder";
import { useRealtimePause } from "@/components/realtime/realtime-provider";
import { CreateTaskModal } from "@/components/task/create-task-modal";
import { useCreateTaskShortcut } from "@/hooks/use-create-task-shortcut";
import {
  TaskDependencyBadge,
  type TaskDependencyIndicator,
} from "@/components/task/task-dependency-badge";
import { TrackedTimeBadge } from "@/components/task/tracked-time-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { useListColumnPreferences } from "@/hooks/use-list-column-preferences";
import { taskUrl } from "@/lib/app-url";
import { describeCustomFieldValue } from "@/lib/custom-fields/column-display";
import {
  type CustomFieldFilters,
  isCustomFieldFilterActive,
} from "@/lib/custom-fields/filters";
import {
  flashDuplicatedTask,
  useIsDuplicateHighlighted,
} from "@/lib/duplicate-highlight";
import { PRIORITY_OPTIONS } from "@/lib/filters/options";
import { filterTasks } from "@/lib/filters/task-filter";
import { STATUS_PRESET_COLORS } from "@/lib/status-colors";
import { toastWithUndo } from "@/lib/undo-toast";
import { cn } from "@/lib/utils";
import { QuickCreateTask } from "./quick-create-task";

type BoardMember = {
  userId: string;
  name: string | null;
  email: string | null;
  image?: string | null;
};

function userInitials(name: string) {
  if (!name) {
    return "?";
  }
  const clean = name.includes("@") ? name.split("@")[0] : name;
  return (
    clean
      .split(/[\s._-]+/)
      .map((n) => n[0])
      .filter(Boolean)
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}

function avatarSrc(key: string | null | undefined): string | undefined {
  return key ? `/api/files/${key}` : undefined;
}

interface Status {
  color: string;
  id: string;
  name: string;
  orderIndex: number;
  type: "OPEN" | "ACTIVE" | "CLOSED";
}

interface Task {
  assignees: { userId: string; name: string; image: string | null }[];
  customFieldValues?: Record<string, unknown>;
  dependencyInfo?: TaskDependencyIndicator;
  id: string;
  orderIndex: number;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  seqNumber: number;
  statusId: string | null;
  tags: { id: string; name: string; color: string }[];
  title: string;
  trackedSeconds?: number;
}

interface BoardViewProps {
  canEdit?: boolean;
  canManage?: boolean;
  customFields?: CustomFieldRow[];
  headerless?: boolean;
  isAdmin?: boolean;
  list: {
    id: string;
    name: string;
    color?: string | null;
    description?: string | null;
  };
  members?: BoardMember[];
  space: { id: string; name: string; color: string | null; logoEmoji: string | null };
  statuses: Status[];
  tags?: { id: string; name: string; color: string }[];
  tasks: Task[];
  workspaceId: string;
}

// ─── Custom field card display (read-only) ──────────────────────────────────
// Board cards never edit custom fields (Task Detail / drawer own that) — this
// only turns a value into a compact, presentational node. Returns null for an
// empty value so the caller can skip rendering the field entirely (cards hide
// empty fields rather than showing a placeholder, unlike the row/detail
// editors in custom-field-editors.tsx).
function renderCardCustomField(
  field: CustomFieldRow,
  value: unknown,
  members: BoardMember[]
): React.ReactNode | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return null;
  }

  if (field.type === "CHECKBOX") {
    if (!value) {
      return null;
    }
    return (
      <Tooltip key={field.id}>
        <TooltipTrigger asChild>
          <span className="flex items-center text-primary">
            <CheckSquareIcon className="size-3.5" weight="fill" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{field.name}</TooltipContent>
      </Tooltip>
    );
  }

  if (field.type === "PERSON") {
    const person = members.find((m) => m.userId === value);
    if (!person) {
      return null;
    }
    return (
      <Tooltip key={field.id}>
        <TooltipTrigger asChild>
          <Avatar className="size-6 shrink-0 border-2 border-background">
            {person.image && (
              <AvatarImage
                alt={person.name ?? undefined}
                src={avatarSrc(person.image)}
              />
            )}
            <AvatarFallback className="text-2xs font-semibold bg-primary text-primary-foreground">
              {userInitials(person.name || person.email || "?")}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent side="top">
          {field.name}: {describeCustomFieldValue(field, value, members)}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (field.type === "SINGLE_SELECT") {
    const option = field.config.options?.find((o) => o.id === value);
    if (!option) {
      return null;
    }
    return (
      <span
        className="shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-medium"
        key={field.id}
        style={{
          backgroundColor: `${option.color ?? "#9CA3AF"}20`,
          color: option.color ?? "#6B7280",
        }}
        title={`${field.name}: ${option.label}`}
      >
        {option.label}
      </span>
    );
  }

  if (field.type === "MULTI_SELECT") {
    const ids = Array.isArray(value) ? (value as string[]) : [];
    const options = field.config.options ?? [];
    const selected = ids
      .map((id) => options.find((o) => o.id === id))
      .filter((o): o is NonNullable<typeof o> => !!o);
    if (selected.length === 0) {
      return null;
    }
    const shown = selected.slice(0, 2);
    const extra = selected.length - shown.length;
    return (
      <span className="flex shrink-0 items-center gap-1" key={field.id}>
        {shown.map((o) => (
          <span
            className="rounded-full px-1.5 py-0.5 text-2xs font-medium"
            key={o.id}
            style={{
              backgroundColor: `${o.color ?? "#9CA3AF"}20`,
              color: o.color ?? "#6B7280",
            }}
            title={`${field.name}: ${o.label}`}
          >
            {o.label}
          </span>
        ))}
        {extra > 0 && (
          <span
            className="text-2xs font-medium text-muted-foreground"
            title={`${field.name}: ${selected.map((o) => o.label).join(", ")}`}
          >
            +{extra}
          </span>
        )}
      </span>
    );
  }

  // TEXT / NUMBER / DATE — plain truncated text, formatted by the same helper
  // the List View column cells use.
  const text = describeCustomFieldValue(field, value, members);
  if (!text) {
    return null;
  }
  return (
    <span
      className="max-w-[110px] truncate text-2xs font-medium text-muted-foreground"
      key={field.id}
      title={`${field.name}: ${text}`}
    >
      {field.type === "DATE" && (
        <CalendarBlankIcon className="-mt-0.5 mr-0.5 inline size-3" />
      )}
      {text}
    </span>
  );
}

// Caps how many custom-field chips a single card shows, regardless of how
// many fields are enabled in the "Fields" menu — keeps card height compact
// even when a list has many custom fields turned on. Extras collapse into a
// single "+N more" chip rather than growing the card.
const MAX_CARD_CUSTOM_FIELDS = 4;

const PRIORITY_ORDER: Record<Task["priority"], number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  NONE: 4,
};

const PRIORITY_CONFIG: Record<
  Task["priority"],
  { label: string; color: string; icon: string }
> = {
  NONE: { label: "No Priority", color: "text-muted-foreground", icon: "😴" },
  LOW: { label: "Low", color: "text-muted-foreground", icon: "🦥" },
  MEDIUM: { label: "Medium", color: "text-yellow-600", icon: "🚶" },
  HIGH: { label: "High", color: "text-orange-500", icon: "🏃" },
  URGENT: { label: "Urgent", color: "text-red-500", icon: "🚨" },
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
  customFields = [],
  members = [],
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
  customFields?: CustomFieldRow[];
  members?: BoardMember[];
}) {
  // The hover quick-actions render only on real (non-overlay) cards that were
  // handed the workspace/list context. The drag overlay stays purely visual.
  const interactive =
    !overlay && !!workspaceId && !!spaceId && !!listId && !!onRefresh;
  const highlighted = useIsDuplicateHighlighted(task.id);

  // Only fields with a real, non-empty value render — cards hide empty
  // custom fields entirely rather than showing a placeholder (unlike the
  // List View / Task Detail editors). Beyond MAX_CARD_CUSTOM_FIELDS, the rest
  // collapse into a single "+N more" chip so an enthusiastically-configured
  // Fields menu can't blow up card height.
  const resolvedCustomFieldNodes = customFields
    .map((field) =>
      renderCardCustomField(field, task.customFieldValues?.[field.id], members)
    )
    .filter((node) => node !== null);
  const customFieldNodes = resolvedCustomFieldNodes.slice(
    0,
    MAX_CARD_CUSTOM_FIELDS
  );
  const hiddenCustomFieldCount =
    resolvedCustomFieldNodes.length - customFieldNodes.length;

  // Inline rename — mirrors the list-row flow (updateTask({ title })).
  const [localTitle, setLocalTitle] = React.useState(task.title);
  const [renaming, setRenaming] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(task.title);
  React.useEffect(() => {
    setLocalTitle(task.title);
  }, [task.title]);

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
        : false
    );
  }, []);

  // Add-subtask mini composer + delete confirm.
  const [subtaskOpen, setSubtaskOpen] = React.useState(false);
  const [subtaskTitle, setSubtaskTitle] = React.useState("");
  const [creatingSubtask, setCreatingSubtask] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  function startRename() {
    if (!canEdit) {
      return;
    }
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
    if (!trimmed || trimmed === localTitle) {
      return;
    }
    setLocalTitle(trimmed); // optimistic
    const res = await updateTask(
      workspaceId!,
      spaceId!,
      listId ?? null,
      task.id,
      { title: trimmed }
    );
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
    if (!completeTarget) {
      return;
    }
    const res = await updateTaskStatus(
      workspaceId!,
      spaceId!,
      listId ?? null,
      task.id,
      completeTarget.id
    );
    if (res && "error" in res) {
      toast.error(res.error);
      return;
    }
    onRefresh?.();
  }

  async function addSubtask() {
    const trimmed = subtaskTitle.trim();
    if (!trimmed || creatingSubtask) {
      return;
    }
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
    const res = await duplicateTask(
      workspaceId!,
      spaceId!,
      listId ?? null,
      task.id
    );
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    flashDuplicatedTask(res.taskId);
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
        highlighted && "ring-2 ring-primary/40 border-primary/40 bg-primary/5"
      )}
    >
      <div
        {...dragListeners}
        className={cn(!overlay && "cursor-grab active:cursor-grabbing")}
      >
        {renaming ? (
          <input
            autoFocus
            className="w-full rounded-md border border-input bg-background px-1.5 py-0.5 text-[13px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            onBlur={() => void commitRename()}
            onChange={(e) => setTitleDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
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
            onPointerDown={(e) => e.stopPropagation()}
            value={titleDraft}
          />
        ) : titleTruncated && !overlay ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className="text-[13px] font-medium text-foreground leading-snug select-none line-clamp-2"
                ref={titleRef}
              >
                {localTitle}
              </p>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs" side="top">
              <span className="block min-w-0 whitespace-normal break-words text-center">
                {localTitle}
              </span>
            </TooltipContent>
          </Tooltip>
        ) : (
          <p
            className="text-[13px] font-medium text-foreground leading-snug select-none line-clamp-2"
            ref={titleRef}
          >
            {localTitle}
          </p>
        )}
        {task.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <span
                className="rounded-full px-1.5 py-0.5 text-2xs font-medium"
                key={tag.id}
                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono text-2xs text-muted-foreground">
              #{task.seqNumber}
            </span>
            {task.dependencyInfo && (
              <TaskDependencyBadge
                incomplete={task.dependencyInfo.incomplete}
                total={task.dependencyInfo.total}
              />
            )}
            <TrackedTimeBadge seconds={task.trackedSeconds} />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            {task.priority !== "NONE" &&
              (() => {
                const cfg = PRIORITY_CONFIG[task.priority];
                return cfg ? (
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs font-bold shrink-0",
                      cfg.color
                    )}
                  >
                    <span>{cfg.icon}</span>
                    {cfg.label}
                  </span>
                ) : null;
              })()}
            {task.assignees.length > 0 && (
              <div className="flex -space-x-1.5 ml-auto">
                {task.assignees.slice(0, 3).map((a) => (
                  <Avatar
                    className="size-7 border-2 border-background"
                    key={a.userId}
                    title={a.name}
                  >
                    {a.image && (
                      <AvatarImage alt={a.name} src={avatarSrc(a.image)} />
                    )}
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
        {resolvedCustomFieldNodes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {customFieldNodes}
            {hiddenCustomFieldCount > 0 && (
              <span
                className="text-2xs font-medium text-muted-foreground"
                title={`${hiddenCustomFieldCount} more field${hiddenCustomFieldCount === 1 ? "" : "s"} set`}
              >
                +{hiddenCustomFieldCount} more
              </span>
            )}
          </div>
        )}
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
              className={iconBtn}
              onClick={() => void toggleComplete()}
              title={isDone ? "Reopen" : "Complete"}
              type="button"
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
              onOpenChange={(o) => {
                setSubtaskOpen(o);
                if (!o) {
                  setSubtaskTitle("");
                }
              }}
              open={subtaskOpen}
            >
              <PopoverTrigger asChild>
                <button className={iconBtn} title="Add subtask" type="button">
                  <ListPlusIcon className="size-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-64 rounded-xl p-2"
                collisionPadding={8}
                side="bottom"
              >
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    className="h-8 rounded-md text-xs"
                    disabled={creatingSubtask}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addSubtask();
                      }
                    }}
                    placeholder="Subtask name…"
                    value={subtaskTitle}
                  />
                  <Button
                    className="h-8 shrink-0 rounded-md px-3 text-xs font-semibold"
                    disabled={creatingSubtask || !subtaskTitle.trim()}
                    onClick={() => void addSubtask()}
                    size="sm"
                  >
                    Add
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
          {canEdit && (
            <button
              className={iconBtn}
              onClick={startRename}
              title="Rename"
              type="button"
            >
              <TextAaIcon className="size-4" />
            </button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button className={iconBtn} title="More" type="button">
                <DotsThreeIcon className="size-4.5" weight="bold" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 rounded-xl p-1">
              <button
                className={menuItem}
                onClick={() => void copyTaskLink()}
                type="button"
              >
                <LinkIcon className="size-3.5 text-muted-foreground" /> Copy
                task link
              </button>
              <a
                className={menuItem}
                href={taskUrl(workspaceId!, task.id)}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ArrowSquareOutIcon className="size-3.5 text-muted-foreground" />{" "}
                Open in new tab
              </a>
              <button
                className={menuItem}
                onClick={() => void copyTaskId()}
                type="button"
              >
                <HashIcon className="size-3.5 text-muted-foreground" /> Copy
                task ID
              </button>
              {canEdit && (
                <>
                  <div className="h-px bg-border my-1" />
                  <button
                    className={menuItem}
                    onClick={() => void handleDuplicate()}
                    type="button"
                  >
                    <CopyIcon className="size-3.5 text-muted-foreground" />{" "}
                    Duplicate
                  </button>
                  <button
                    className={menuItem}
                    onClick={() => void handleArchive()}
                    type="button"
                  >
                    <ArchiveIcon className="size-3.5 text-muted-foreground" />{" "}
                    Archive
                  </button>
                </>
              )}
              {isAdmin && (
                <button
                  className={cn(
                    menuItem,
                    "text-red-600 hover:bg-red-50 hover:text-red-700"
                  )}
                  onClick={() => setDeleteOpen(true)}
                  type="button"
                >
                  <TrashIcon className="size-3.5" /> Delete
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      )}

      {interactive && (
        <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
          <DialogContent className="rounded-xl sm:max-w-sm">
            <DialogTitle className="sr-only">Delete task</DialogTitle>
            <div className="flex flex-col items-center gap-3 pt-2 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-red-100">
                <TrashIcon className="size-6 text-red-600" />
              </div>
              <div>
                <p className="text-base font-semibold">Delete task?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  “{localTitle}” will be permanently deleted. This can’t be
                  undone.
                </p>
              </div>
              <div className="mt-2 flex w-full gap-2">
                <Button
                  className="flex-1 rounded-md"
                  disabled={deleting}
                  onClick={() => setDeleteOpen(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-md"
                  disabled={deleting}
                  onClick={() => void confirmDelete()}
                  variant="destructive"
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
  customFields,
  members,
}: {
  task: Task;
  workspaceId: string;
  spaceId: string;
  listId: string;
  statuses: Status[];
  canEdit?: boolean;
  isAdmin?: boolean;
  onRefresh: () => void;
  customFields: CustomFieldRow[];
  members: BoardMember[];
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
        canEdit={canEdit}
        customFields={customFields}
        dragListeners={clickableListeners}
        isAdmin={isAdmin}
        isDragging={isDragging}
        listId={listId}
        members={members}
        onRefresh={onRefresh}
        spaceId={spaceId}
        statuses={statuses}
        task={task}
        workspaceId={workspaceId}
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
  customFields,
  members,
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
  customFields: CustomFieldRow[];
  members: BoardMember[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <div
      className="flex w-64 shrink-0 flex-col rounded-xl p-2 gap-2 max-h-[calc(100vh-14rem)]"
      style={{ backgroundColor: `${status.color}14` }}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-1 py-1">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: status.color }}
        />
        <span className="flex-1 font-semibold text-sm uppercase tracking-wide text-foreground/80">
          {status.name}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: `${status.color}22`, color: status.color }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Droppable task list — flex-1 + overflow-y-auto gives each column its own scroll */}
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className={cn(
            "flex flex-col gap-2 rounded-lg p-1 transition-all flex-1 overflow-y-auto min-h-0 no-scrollbar",
            tasks.length === 0 && "min-h-8"
          )}
          ref={setNodeRef}
          style={
            isOver
              ? { boxShadow: `inset 0 0 0 2px ${status.color}` }
              : undefined
          }
        >
          {tasks.map((t) => (
            <TaskCard
              canEdit={canEdit}
              customFields={customFields}
              isAdmin={isAdmin}
              key={t.id}
              listId={list.id}
              members={members}
              onRefresh={onRefresh}
              spaceId={space.id}
              statuses={statuses}
              task={t}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      </SortableContext>

      <QuickCreateTask
        listId={list.id}
        placeholder="Add task"
        spaceId={space.id}
        statuses={statuses}
        statusId={status.id}
        workspaceId={workspaceId}
      />
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function BoardView({
  workspaceId,
  space,
  list,
  statuses,
  tasks,
  members = [],
  customFields = [],
  canEdit,
  canManage,
  isAdmin,
}: BoardViewProps) {
  const router = useRouter();
  // Re-pull the server-rendered board after a card quick-action. The actions
  // revalidate + broadcast server-side; this refreshes the current view too.
  const handleRefresh = React.useCallback(() => router.refresh(), [router]);

  // ── Board "Fields" preference — which custom fields show on cards ────────
  // Reuses the same generic {id,label}[] preference hook List View's Columns
  // menu uses (hooks/use-list-column-preferences.ts), keyed separately
  // (`${list.id}:board`) so choosing card fields doesn't also toggle List
  // View's table columns. Hidden by default, same as List View.
  const fieldOptions = React.useMemo(
    () => customFields.map((f) => ({ id: f.id, label: f.name })),
    [customFields]
  );
  const { visibleIds: visibleFieldIds, setVisibleIds: setVisibleFieldIds } =
    useListColumnPreferences(`${list.id}:board`, fieldOptions);
  const visibleCustomFields = React.useMemo(
    () => customFields.filter((f) => visibleFieldIds.includes(f.id)),
    [customFields, visibleFieldIds]
  );

  // ── "Add group" — create a new status column (reuses createListStatus). ────
  const [newGroupOpen, setNewGroupOpen] = React.useState(false);
  const [newGroupName, setNewGroupName] = React.useState("");
  const [newGroupColor, setNewGroupColor] = React.useState("#6B7280");
  const [creatingGroup, setCreatingGroup] = React.useState(false);

  async function handleCreateGroup() {
    const name = newGroupName.trim();
    if (!name || creatingGroup) {
      return;
    }
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
  React.useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // ── Toolbar state ─────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = React.useState(false);
  // "C" opens the Create Task popup (same as the toolbar button).
  useCreateTaskShortcut(() => setCreateOpen(true), canEdit || isAdmin);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<"name" | "priority" | null>(null);
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
  // Sort is a single-select menu — picking an option closes the popover
  // immediately, same as FacetFilter's `single` mode.
  const [sortMenuOpen, setSortMenuOpen] = React.useState(false);

  // Local filter state (mirrors list-view pattern)
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = React.useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = React.useState<string[]>([]);
  const [customFieldFilters, setCustomFieldFilters] =
    React.useState<CustomFieldFilters>({});

  // ── Filters (built-in + custom fields) ────────────────────────────────────
  // Option lists shared between the standalone toolbar buttons above and the
  // Filters builder below, so there's exactly one place that builds them.
  const statusOptions = React.useMemo(
    () => statuses.map((s) => ({ value: s.id, label: s.name, color: s.color })),
    [statuses]
  );
  const assigneeOptions = React.useMemo(
    () => [
      { value: "unassigned", label: "Unassigned" },
      ...members.map((m) => ({
        value: m.userId,
        label: m.name || m.email || "Unknown",
      })),
    ],
    [members]
  );
  // Status/Priority/Assignee already have their own dedicated toolbar
  // buttons directly above — the Filters builder is only for fields that
  // don't, so it stays the "custom + future advanced fields" picker rather
  // than duplicating what's already one click away.
  const filterFields = React.useMemo(
    () => customFields.map((field) => ({ key: field.id, label: field.name })),
    [customFields]
  );

  function isFilterFieldActive(key: string) {
    return isCustomFieldFilterActive(customFieldFilters[key]);
  }

  function clearFilterField(key: string) {
    setCustomFieldFilters((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }

  function renderFilterControl(key: string) {
    const field = customFields.find((f) => f.id === key);
    if (!field) {
      return null;
    }
    return (
      <CustomFieldFilterControl
        field={field}
        members={members}
        onChange={(next) =>
          setCustomFieldFilters((prev) => ({ ...prev, [field.id]: next }))
        }
        value={customFieldFilters[field.id]}
      />
    );
  }

  // ── Filtered + sorted tasks (for display) ────────────────────────────────
  const processedTasks = React.useMemo(() => {
    let result = filterTasks(
      localTasks,
      {
        searchQuery,
        statusFilter,
        priorityFilter,
        assigneeFilter,
        customFieldFilters,
      },
      customFields,
      members
    );

    if (sortBy === "name") {
      result = [...result].sort((a, b) =>
        sortOrder === "asc"
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title)
      );
    } else if (sortBy === "priority") {
      result = [...result].sort((a, b) => {
        const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        return sortOrder === "asc" ? diff : -diff;
      });
    }

    return result;
  }, [
    localTasks,
    searchQuery,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    customFieldFilters,
    customFields,
    members,
    sortBy,
    sortOrder,
  ]);

  // tasksByStatus uses processed tasks for display; DnD handlers still use localTasks
  const tasksByStatus = React.useMemo(() => {
    const map: Record<string, Task[]> = Object.fromEntries(
      statuses.map((s) => [s.id, []])
    );
    for (const t of processedTasks) {
      if (t.statusId && map[t.statusId]) {
        map[t.statusId].push(t);
      }
    }
    return map;
  }, [processedTasks, statuses]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
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
    if (!over) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) {
      return;
    }

    const activeStatus = findStatusForTask(activeId);
    // over could be a column (statusId) or another task
    const overStatus =
      statuses.find((s) => s.id === overId)?.id ?? findStatusForTask(overId);

    if (!activeStatus || !overStatus) {
      return;
    }

    if (activeStatus === overStatus) {
      // Same column — reorder positions optimistically
      setLocalTasks((prev) => {
        const oldIndex = prev.findIndex((t) => t.id === activeId);
        const newIndex = prev.findIndex((t) => t.id === overId);
        if (oldIndex === -1 || newIndex === -1) {
          return prev;
        }
        return arrayMove(prev, oldIndex, newIndex);
      });
    } else {
      // Cross-column — move task to new column
      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, statusId: overStatus } : t
        )
      );
    }
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    endDrag();
    if (!over) {
      return;
    }

    const activeId = active.id as string;
    const finalStatus = findStatusForTask(activeId); // from localTasks after all onDragOver updates
    const originalStatus = tasks.find((t) => t.id === activeId)?.statusId;

    if (!finalStatus) {
      return;
    }

    if (finalStatus === originalStatus) {
      // Same column — persist new card order
      const columnTaskIds = localTasks
        .filter((t) => t.statusId === finalStatus)
        .map((t) => t.id);
      const originalIds = tasks
        .filter((t) => t.statusId === originalStatus)
        .map((t) => t.id);
      if (columnTaskIds.join(",") === originalIds.join(",")) {
        return; // no change
      }
      const res = await reorderTasksInStatus(
        workspaceId,
        space.id,
        list.id,
        columnTaskIds
      );
      if ("error" in res) {
        setLocalTasks(tasks);
      }
    } else {
      // Cross-column — update status
      const res = await updateTaskStatus(
        workspaceId,
        space.id,
        list.id,
        activeId,
        finalStatus
      );
      if ("error" in res) {
        setLocalTasks(tasks);
      }
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <CreateTaskModal
        canManage={canEdit || isAdmin}
        listId={list.id}
        onOpenChange={setCreateOpen}
        open={createOpen}
        spaceId={space.id}
        statuses={statuses}
        workspaceId={workspaceId}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
        {/* Logical groups get their own gap-2 row; the gap-4 on this wrapper
            is what separates the groups from each other (Search /
            Status+Priority+Assignee+Filters / Sort+Fields) — a bit more
            breathing room than the gap-2 used inside each group. */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <SearchInput
            className="w-64 focus:w-80"
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            placeholder="Search tasks…"
            value={searchQuery}
          />

          {/* Filters — shared facet controls (same state + filter logic).
              Kept exactly as standalone toolbar buttons — the Filters
              builder is an additional entry point onto this same state, not
              a replacement for these. */}
          <div className="flex items-center gap-2 flex-wrap">
            <FacetFilter
              label="Status"
              onChange={setStatusFilter}
              options={statusOptions}
              selected={statusFilter}
            />
            <FacetFilter
              label="Priority"
              onChange={setPriorityFilter}
              options={PRIORITY_OPTIONS}
              selected={priorityFilter}
            />
            {members.length > 0 && (
              <FacetFilter
                label="Assignee"
                onChange={setAssigneeFilter}
                options={assigneeOptions}
                searchable
                selected={assigneeFilter}
              />
            )}
          </div>

          {/* One compact "Filters" entry for custom fields only —
              Status/Priority/Assignee already have dedicated buttons above,
              so they're deliberately excluded here to avoid duplicating
              them. Custom fields are picked dynamically instead of getting
              their own always-visible toolbar button, so the toolbar stays
              the same width no matter how many custom fields a list has.
              Hidden entirely when there are none — it would otherwise open
              onto an empty "No filters yet" picker with nothing to add. */}
          {filterFields.length > 0 && (
            <FilterBuilder
              fields={filterFields}
              isActive={isFilterFieldActive}
              onClear={clearFilterField}
              renderControl={renderFilterControl}
            />
          )}

          <div className="mx-1 h-5 w-px shrink-0 bg-border" />

          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort */}
            <Popover onOpenChange={setSortMenuOpen} open={sortMenuOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 h-8 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer select-none">
                  <ArrowsDownUpIcon className="size-3.5" />
                  Sort:{" "}
                  {sortBy
                    ? sortBy.charAt(0).toUpperCase() + sortBy.slice(1)
                    : "None"}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-44 p-1 flex flex-col gap-0.5"
              >
                <button
                  className={cn(
                    "px-2 py-1.5 text-xs font-semibold text-left rounded hover:bg-accent cursor-pointer text-foreground",
                    !sortBy && "bg-accent"
                  )}
                  onClick={() => {
                    setSortBy(null);
                    setSortMenuOpen(false);
                  }}
                >
                  None
                </button>
                <button
                  className={cn(
                    "px-2 py-1.5 text-xs font-semibold text-left rounded hover:bg-accent cursor-pointer text-foreground",
                    sortBy === "name" && "bg-accent"
                  )}
                  onClick={() => {
                    setSortBy("name");
                    setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
                    setSortMenuOpen(false);
                  }}
                >
                  Task Name
                </button>
                <button
                  className={cn(
                    "px-2 py-1.5 text-xs font-semibold text-left rounded hover:bg-accent cursor-pointer text-foreground",
                    sortBy === "priority" && "bg-accent"
                  )}
                  onClick={() => {
                    setSortBy("priority");
                    setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
                    setSortMenuOpen(false);
                  }}
                >
                  Priority
                </button>
              </PopoverContent>
            </Popover>

            {/* Fields — which custom fields show on cards (hidden by
                default, persisted per board via useListColumnPreferences).
                Cards are read-only; editing stays on Task Detail / the
                drawer. */}
            {customFields.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "flex h-8 shrink-0 select-none items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors cursor-pointer",
                      visibleFieldIds.length > 0
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                    type="button"
                  >
                    <SlidersHorizontalIcon className="size-3.5" />
                    Fields
                    {visibleFieldIds.length > 0 && (
                      <span className="font-bold">
                        ({visibleFieldIds.length})
                      </span>
                    )}
                    <CaretDownIcon className="size-3 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 rounded-xl p-1.5">
                  <p className="px-2 py-1 text-2xs font-bold uppercase tracking-wide text-muted-foreground">
                    Custom Fields
                  </p>
                  <FacetOptionList
                    emptyText="No custom fields"
                    onChange={setVisibleFieldIds}
                    options={fieldOptions.map((f) => ({
                      value: f.id,
                      label: f.label,
                    }))}
                    searchable={fieldOptions.length > 6}
                    selected={visibleFieldIds}
                  />
                </PopoverContent>
              </Popover>
            )}

            <div className="mx-1 h-5 w-px shrink-0 bg-border" />

            {/* Manage Custom Fields — a discoverability shortcut straight to
                Project Settings → Custom Fields, not a general Settings
                button. Only shown to full-access members (same permission
                requireFieldAdmin enforces for a space-scoped field), and
                independent of whether any custom fields exist yet — that's
                the point: it's how you'd go create the first one when
                Filters/Fields are hidden. */}
            {canManage && (
              <button
                className="flex items-center justify-center size-8 rounded-lg border border-border text-foreground/60 hover:bg-accent/30 hover:text-foreground transition-colors cursor-pointer"
                onClick={() =>
                  router.push(
                    `/${workspaceId}/${space.id}/settings/custom-fields`
                  )
                }
                title="Manage Custom Fields"
                type="button"
              >
                <ManageFieldsIcon className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Create Task button */}
        <button
          className="flex items-center gap-1.5 h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-all shadow-sm shrink-0 cursor-pointer select-none"
          onClick={() => setCreateOpen(true)}
        >
          <PlusIcon className="size-3.5" weight="bold" />
          Create Task
        </button>
      </div>

      <DndContext
        collisionDetection={closestCenter}
        id="board-dnd"
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragStart={onDragStart}
        sensors={sensors}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 items-start">
          {statuses.map((status) => (
            <Column
              canEdit={canEdit}
              customFields={visibleCustomFields}
              isAdmin={isAdmin}
              key={status.id}
              list={list}
              members={members}
              onRefresh={handleRefresh}
              space={space}
              status={status}
              statuses={statuses}
              tasks={tasksByStatus[status.id] ?? []}
              workspaceId={workspaceId}
            />
          ))}

          {/* Add group — creates a new status column (Full Access only). */}
          {canManage && (
            <button
              className="flex h-9 shrink-0 select-none items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
              onClick={() => setNewGroupOpen(true)}
              type="button"
            >
              <PlusIcon className="size-4" weight="bold" /> Add group
            </button>
          )}
        </div>

        {/* Drag overlay — shown while dragging */}
        <DragOverlay>
          {activeTask && (
            <CardContent
              customFields={visibleCustomFields}
              members={members}
              overlay
              task={activeTask}
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* New group (status) dialog — mirrors the List view's New Status dialog. */}
      {canManage && (
        <Dialog onOpenChange={setNewGroupOpen} open={newGroupOpen}>
          <DialogContent className="rounded-xl sm:max-w-xs">
            <DialogTitle className="text-sm font-bold">New Group</DialogTitle>
            <div className="space-y-3">
              <Input
                autoFocus
                className="h-9 text-xs"
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleCreateGroup();
                  }
                }}
                placeholder="Group name"
                value={newGroupName}
              />
              <div className="flex flex-wrap gap-2">
                {STATUS_PRESET_COLORS.map((color) => (
                  <button
                    className={cn(
                      "size-6 cursor-pointer rounded-full transition-transform",
                      newGroupColor === color &&
                        "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                    )}
                    key={color}
                    onClick={() => setNewGroupColor(color)}
                    style={{ backgroundColor: color }}
                    type="button"
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                className="h-8 text-xs font-semibold"
                onClick={() => setNewGroupOpen(false)}
                variant="ghost"
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
