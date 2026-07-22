"use client";

import {
  ArchiveIcon,
  ArrowLeftIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  CaretRightIcon,
  CheckIcon,
  ClipboardTextIcon,
  CopyIcon,
  DotsThreeIcon,
  EyeIcon,
  EyeSlashIcon,
  FileIcon,
  FilePdfIcon,
  FlagIcon,
  GearIcon,
  LinkIcon,
  PaperclipIcon,
  PlusIcon,
  PushPinIcon,
  TagIcon,
  TrashIcon,
  UserIcon,
  UserPlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import {
  GitBranch,
  ListChecks,
  ListTree,
  type LucideIcon,
  Timer,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  archiveTask,
  createSubtask,
  deleteTask,
  duplicateTask,
  getTaskDetail,
  getWorkspaceMembers,
  unarchiveTask,
  updateTask,
  updateTaskStatus,
} from "@/app/actions/task";
import {
  deleteCustomFieldValue,
  getCustomFieldsForTasks,
  setCustomFieldValue,
  type CustomFieldRow,
} from "@/app/actions/custom-field";
import {
  addAssignee,
  removeAssignee,
  toggleWatcher,
} from "@/app/actions/task-assignee";
import {
  addChecklistItem,
  createChecklist,
  deleteChecklist,
  deleteChecklistItem,
  toggleChecklistItem,
} from "@/app/actions/task-checklist";
import {
  addTaskTag,
  createTag,
  deleteTag,
  getWorkspaceTags,
  removeTaskTag,
} from "@/app/actions/task-tag";
import { ManageStatusesDialog } from "@/components/list/manage-statuses-dialog";
import { useRealtimeRefetch } from "@/components/realtime/realtime-provider";
import {
  AttachmentPreviewProvider,
  useAttachmentPreview,
} from "@/components/task/attachment-preview-modal";
import {
  TaskActivityFeed,
  type TaskActivityFeedHandle,
} from "@/components/task/task-activity-feed";
import { CustomFieldEditor } from "@/components/task/custom-field-editors";
import { TaskDependencies } from "@/components/task/task-dependencies";
import { TaskDescriptionEditor } from "@/components/task/task-description-editor";
import { TaskTimeTracking } from "@/components/task/task-time-tracking";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { InviteMemberModal } from "@/components/workspace/invite-member-modal";
import { flashDuplicatedTask } from "@/lib/duplicate-highlight";
import { useSetTopbar } from "@/lib/topbar-context";
import { toastWithUndo } from "@/lib/undo-toast";
import { cn } from "@/lib/utils";
import { TaskDetailSkeleton } from "./task-detail-skeleton";

type Priority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; icon: string; bg: string }
> = {
  NONE: {
    label: "No Priority",
    color: "text-muted-foreground",
    icon: "😴",
    bg: "bg-muted/60",
  },
  LOW: {
    label: "Low",
    color: "text-blue-500",
    icon: "🦥",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  MEDIUM: {
    label: "Medium",
    color: "text-yellow-500",
    icon: "🚶",
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
  },
  HIGH: {
    label: "High",
    color: "text-orange-500",
    icon: "🏃",
    bg: "bg-orange-50 dark:bg-orange-950/40",
  },
  URGENT: {
    label: "Urgent",
    color: "text-red-500",
    icon: "🚨",
    bg: "bg-red-50 dark:bg-red-950/40",
  },
};

function userInitials(name: string | null, email: string | null) {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
}

// ─── Field row (label + value in grid) ───────────────────────────────────────

function FieldRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2 w-36 shrink-0 text-sm text-muted-foreground pt-0.5">
        <span className="shrink-0">{icon}</span>
        {label}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── Collapsible content-section header (Subtasks / Dependencies / Checklist) ──

function SectionHeader({
  icon: Icon,
  title,
  description,
  count,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  count: number;
}) {
  return (
    <span className="flex flex-col gap-0.5">
      {/* Icon + title sit together at the left edge. */}
      <span className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold">{title}</span>
        {count > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-2xs font-medium text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
      </span>
      {/* Description is indented (pl-6 = icon width + gap) so it aligns under
          the title text, not the icon. Reads as a subtitle when collapsed. */}
      <span className="pl-6 text-xs font-normal text-muted-foreground group-aria-expanded/accordion-trigger:hidden">
        {description}
      </span>
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface TaskDetailPageProps {
  canPinToList?: boolean;
  listId: string;
  listName: string;
  spaceId: string;
  taskId: string;
  workspaceId: string;
  workspaceName: string;
}

export function TaskDetailPage({
  workspaceId,
  spaceId,
  listId,
  taskId,
  listName,
  workspaceName,
  canPinToList,
}: TaskDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromView = searchParams.get("from");
  const fromSprintId = searchParams.get("sid");

  const contextLabel = fromView === "sprint" ? "Sprint" : listName || "List";
  useSetTopbar({
    breadcrumbs: [{ label: workspaceName, href: `/${workspaceId}` }],
    title: contextLabel,
  });
  const [data, setData] = React.useState<Awaited<
    ReturnType<typeof getTaskDetail>
  > | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [titleEditing, setTitleEditing] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState("");
  const [descDraft, setDescDraft] = React.useState("");
  const [members, setMembers] = React.useState<
    { userId: string; name: string; email: string; image: string | null }[]
  >([]);
  const [allTags, setAllTags] = React.useState<
    { id: string; name: string; color: string }[]
  >([]);
  const [customFields, setCustomFields] = React.useState<CustomFieldRow[]>([]);
  const [customFieldValues, setCustomFieldValues] = React.useState<
    Record<string, unknown>
  >({});
  const [tagSearch, setTagSearch] = React.useState("");
  const [deleteTagTarget, setDeleteTagTarget] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [newChecklistName, setNewChecklistName] = React.useState("");
  const [addingChecklist, setAddingChecklist] = React.useState(false);
  const [newItemTexts, setNewItemTexts] = React.useState<
    Record<string, string>
  >({});
  const feedRef = React.useRef<TaskActivityFeedHandle>(null);
  const [saving, setSaving] = React.useState(false);
  const [subtaskInput, setSubtaskInput] = React.useState("");
  // The subtask input only appears after clicking "+ Add subtask".
  const [addingSubtask, setAddingSubtask] = React.useState(false);
  // Completed subtasks are hidden behind a "Completed (N)" row by default.
  const [completedOpen, setCompletedOpen] = React.useState(false);
  const subtaskInputRef = React.useRef<HTMLInputElement>(null);
  // Subtask queued for deletion (confirmation dialog target) — a quick
  // hover-delete so removing one doesn't require opening it first.
  const [deletingSubtask, setDeletingSubtask] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deletingSubtaskBusy, setDeletingSubtaskBusy] = React.useState(false);
  // Which content sections (subtasks / dependencies / checklist) are expanded.
  // Multiple can be open at once: sections that already have data auto-open so
  // they show together, while empty ones start collapsed and auto-collapse on
  // an outside click.
  const [openSections, setOpenSections] = React.useState<string[]>([]);
  const sectionsRef = React.useRef<HTMLDivElement>(null);
  // The task we've already applied the "open sections with data" default to, so
  // a section the user later collapses is not re-opened on the next refetch.
  const initedSectionsTaskRef = React.useRef<string | null>(null);
  const [attachments, setAttachments] = React.useState<
    {
      id: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      url: string;
      commentId: string | null;
      isInline?: boolean;
      uploadedBy: string;
      createdAt: Date;
    }[]
  >([]);
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Attachment drop-zone drag state. `dragDepth` counts enter/leave across child
  // elements so the overlay doesn't flicker when moving over children.
  const [attachmentDragOver, setAttachmentDragOver] = React.useState(false);
  const attachmentDragDepth = React.useRef(0);
  const [creatingSubtask, setCreatingSubtask] = React.useState(false);
  // Reset add-forms, completed-toggle and section state on task switch.
  React.useEffect(() => {
    setAddingSubtask(false);
    setCompletedOpen(false);
    setOpenSections([]);
    initedSectionsTaskRef.current = null;
  }, [taskId]);
  // Auto-open every section that already has data, once per task, so a task's
  // subtasks / dependencies / checklist are shown together on open. Guarded to
  // the current task's data and to run only once, so sections the user later
  // collapses stay collapsed across refetches.
  React.useEffect(() => {
    if (!data || "error" in data) {
      return;
    }
    if (data.task.id !== taskId) {
      return;
    }
    if (initedSectionsTaskRef.current === taskId) {
      return;
    }
    initedSectionsTaskRef.current = taskId;
    const open: string[] = [];
    if (!data.task.parentTaskId && (data.subtasks?.length ?? 0) > 0) {
      open.push("subtasks");
    }
    if (data.blockedBy.length + data.blocks.length > 0) {
      open.push("dependencies");
    }
    if (data.checklists.length > 0) {
      open.push("checklist");
    }
    if (data.timeEntries.length > 0) {
      open.push("timeTracking");
    }
    setOpenSections(open);
  }, [data, taskId]);
  // Clicking outside the sections collapses any *empty* open section (tidies up
  // add-forms opened but not used). Sections that have data stay open — the user
  // closes those with an explicit click on the header. Clicks inside portaled
  // overlays (the "Add dependency" dialog / popovers / menus) are ignored.
  React.useEffect(() => {
    if (openSections.length === 0) {
      return;
    }
    const hasData = (section: string): boolean => {
      if (!data || "error" in data) {
        return false;
      }
      if (section === "subtasks") {
        return (data.subtasks?.length ?? 0) > 0;
      }
      if (section === "dependencies") {
        return data.blockedBy.length + data.blocks.length > 0;
      }
      if (section === "checklist") {
        return data.checklists.length > 0;
      }
      if (section === "timeTracking") {
        return data.timeEntries.length > 0;
      }
      return false;
    };
    // No empty sections open → nothing an outside click would collapse.
    if (openSections.every(hasData)) {
      return;
    }
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (sectionsRef.current?.contains(target)) {
        return;
      }
      if (
        target.closest(
          '[role="dialog"],[role="menu"],[data-radix-popper-content-wrapper]'
        )
      ) {
        return;
      }
      setOpenSections((prev) => prev.filter(hasData));
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openSections, data]);
  const [isPinned, setIsPinned] = React.useState(false);
  const [statusPopoverOpen, setStatusPopoverOpen] = React.useState(false);
  const [manageStatusesOpen, setManageStatusesOpen] = React.useState(false);
  const [priorityPopoverOpen, setPriorityPopoverOpen] = React.useState(false);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = React.useState(false);
  const [startCalOpen, setStartCalOpen] = React.useState(false);
  const [endCalOpen, setEndCalOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function fetchAll(showSpinner: boolean) {
    if (showSpinner) {
      setLoading(true);
    }
    const [detail, mem, tags, attRes, pinRes, customFieldsRes] = await Promise.all([
      getTaskDetail(workspaceId, spaceId, taskId),
      getWorkspaceMembers(workspaceId),
      getWorkspaceTags(workspaceId),
      fetch(`/api/tasks/${taskId}/attachments`)
        .then((r) => r.json())
        .catch(() => ({ attachments: [] })),
      fetch(`/api/tasks/${taskId}/pin`, { method: "GET" })
        .then((r) => (r.ok ? r.json() : { pinned: false }))
        .catch(() => ({ pinned: false })),
      getCustomFieldsForTasks(workspaceId, spaceId, listId, [taskId]),
    ]);
    setData(detail && !("error" in detail) ? detail : null);
    if (mem && !("error" in mem)) {
      setMembers(
        mem.members
          .filter((m): m is typeof m & { userId: string } => m.userId !== null)
          .map((m) => ({
            userId: m.userId!,
            name: m.name,
            email: m.email,
            image: m.image,
          }))
      );
    }
    if (tags && !("error" in tags)) {
      setAllTags(tags.tags);
    }
    if (attRes?.attachments) {
      setAttachments(attRes.attachments);
    }
    setIsPinned(!!pinRes?.pinned);
    if (customFieldsRes && !("error" in customFieldsRes)) {
      setCustomFields(customFieldsRes.fields);
      setCustomFieldValues(customFieldsRes.valuesByTask[taskId] ?? {});
    }
    if (showSpinner) {
      setLoading(false);
    }
  }

  async function handleTogglePin() {
    const next = !isPinned;
    setIsPinned(next);
    const res = await fetch(`/api/tasks/${taskId}/pin`, {
      method: next ? "POST" : "DELETE",
    });
    if (!res.ok) {
      setIsPinned(!next);
      const data = await res.json().catch(() => ({}));
      // eslint-disable-next-line no-console
      console.error("Pin toggle failed:", data.error);
    }
  }

  // Initial load shows spinner; subsequent refreshes are silent
  const load = () => fetchAll(false);

  React.useEffect(() => {
    fetchAll(true);
  }, [taskId]);

  // Live updates: when another user changes THIS task, refetch just this task.
  // Events carrying a different taskId are ignored; events without one (list /
  // space / workspace changes) refetch, which is the safe default. The provider
  // already debounces and defers while typing / an overlay is open / tab hidden.
  useRealtimeRefetch((meta) => {
    if (meta?.taskId && meta.taskId !== taskId) {
      return;
    }
    void load();
  });

  // Last values the server gave us, so we can tell "no local edit" (draft still
  // equals the server value) from "unsaved local edit" (draft diverged).
  const serverTitleRef = React.useRef("");
  const serverDescRef = React.useRef("");

  React.useEffect(() => {
    if (!data || "error" in data) {
      return;
    }
    const nextTitle = data.task.title;
    const nextDesc =
      typeof data.task.description === "string"
        ? data.task.description
        : data.task.description
          ? JSON.stringify(data.task.description)
          : "";

    // Capture the PREVIOUS server values before overwriting the refs — the
    // functional updaters below run after this effect body, so they must close
    // over the old values, not the new ones.
    const prevServerTitle = serverTitleRef.current;
    const prevServerDesc = serverDescRef.current;

    // Adopt the incoming server value ONLY when the field has no unsaved local
    // change. Leaving `descDraft` untouched also means TaskDescriptionEditor's
    // setContent sync never runs → no cursor reset while someone is typing.
    setTitleDraft((cur) =>
      !titleEditing && cur === prevServerTitle ? nextTitle : cur
    );
    setDescDraft((cur) => (cur === prevServerDesc ? nextDesc : cur));

    // Self-heals: after a save the draft equals the new server value again, so
    // later remote updates are adopted normally.
    serverTitleRef.current = nextTitle;
    serverDescRef.current = nextDesc;
  }, [data, titleEditing]);

  const listBackUrl =
    fromView === "sprint" && fromSprintId
      ? `/${workspaceId}/${spaceId}/sprint/${fromSprintId}`
      : listId
        ? `/${workspaceId}/${spaceId}/list/${listId}${fromView && fromView !== "sprint" ? `?view=${fromView}` : ""}`
        : `/${workspaceId}`;

  if (loading) {
    return <TaskDetailSkeleton />;
  }

  if (!data || "error" in data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Task not found.</p>
        <Button onClick={() => router.push(listBackUrl)} variant="ghost">
          <ArrowLeftIcon className="size-4 mr-2" /> Back to list
        </Button>
      </div>
    );
  }

  const {
    task: t,
    assignees,
    watchers,
    tags,
    checklists,
    blockedBy,
    blocks,
    timeEntries,
    canEdit,
    statuses,
    subtasks,
    parentTask,
    currentUserId,
  } = data;
  const backUrl = t.parentTaskId
    ? `/${workspaceId}/task/${t.parentTaskId}`
    : listBackUrl;
  const isWatching = watchers.some((w) => w.userId === currentUserId);
  const currentStatus = statuses.find((s) => s.id === t.statusId);
  const priority =
    PRIORITY_CONFIG[t.priority as Priority] ?? PRIORITY_CONFIG.NONE;
  const totalChecked = checklists
    .flatMap((c) => c.items)
    .filter((i) => i.isChecked).length;
  const totalItems = checklists.flatMap((c) => c.items).length;
  const checkProgress =
    totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;
  const filteredTags = allTags.filter((t) =>
    t.name.toLowerCase().includes(tagSearch.toLowerCase())
  );
  const exactTagMatch = allTags.some(
    (t) => t.name.toLowerCase() === tagSearch.toLowerCase()
  );

  const dueDateStart = t.dueDateStart ? new Date(t.dueDateStart) : null;
  const dueDateEnd = t.dueDateEnd ? new Date(t.dueDateEnd) : null;

  async function saveTitle() {
    if (!titleDraft.trim() || titleDraft === t.title) {
      setTitleEditing(false);
      return;
    }
    await updateTask(workspaceId, spaceId, listId, taskId, {
      title: titleDraft.trim(),
    });
    setTitleEditing(false);
    load();
  }

  async function saveDescription() {
    // Blur fires this even when nothing was edited. Skip the write (and its
    // "updated the description" activity entry) when the draft still matches the
    // server value. Reliable because loading the value uses setContent with
    // emitUpdate:false, so it never mutates descDraft on its own.
    if (descDraft === serverDescRef.current) {
      return;
    }
    await updateTask(workspaceId, spaceId, listId, taskId, {
      description: descDraft,
    });
    load();
  }

  async function handleStatusChange(statusId: string) {
    setStatusPopoverOpen(false);
    await updateTaskStatus(workspaceId, spaceId, listId, taskId, statusId);
    load();
  }

  async function handlePriorityChange(p: Priority) {
    setPriorityPopoverOpen(false);
    await updateTask(workspaceId, spaceId, listId, taskId, { priority: p });
    load();
  }

  async function handleDueDateChange(
    field: "start" | "end",
    date: Date | null
  ) {
    if (field === "start") {
      // Keep end >= start: if the new start is after the current end, move end too.
      const patch =
        date && dueDateEnd && date > dueDateEnd
          ? { dueDateStart: date, dueDateEnd: date }
          : { dueDateStart: date };
      await updateTask(workspaceId, spaceId, listId, taskId, patch);
    } else {
      await updateTask(workspaceId, spaceId, listId, taskId, {
        dueDateEnd: date,
      });
    }
    load();
  }

  async function handleToggleAssignee(userId: string) {
    const already = assignees.some((a) => a.userId === userId);
    if (already) {
      await removeAssignee(workspaceId, spaceId, listId, taskId, userId);
    } else {
      await addAssignee(workspaceId, spaceId, listId, taskId, userId);
    }
    load();
  }

  // Updates local state directly on success instead of calling load() — a
  // custom field value change doesn't invalidate anything else fetchAll()
  // loads, so there's nothing to gain from re-fetching the whole task.
  // `value === null` means "clear" — routed to deleteCustomFieldValue (revert
  // to the field's default) rather than persisting an explicit null.
  async function handleCustomFieldChange(fieldId: string, value: unknown) {
    if (value === null || value === undefined) {
      const res = await deleteCustomFieldValue(workspaceId, spaceId, taskId, fieldId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const field = customFields.find((f) => f.id === fieldId);
      setCustomFieldValues((prev) => ({ ...prev, [fieldId]: field?.defaultValue ?? null }));
      return;
    }
    const res = await setCustomFieldValue(workspaceId, spaceId, taskId, fieldId, value);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handleToggleTag(tagId: string) {
    const already = tags.some((tag) => tag.id === tagId);
    if (already) {
      await removeTaskTag(workspaceId, spaceId, listId, taskId, tagId);
    } else {
      await addTaskTag(workspaceId, spaceId, listId, taskId, tagId);
    }
    load();
  }

  async function handleClearAllTags() {
    await Promise.all(
      tags.map((tag) =>
        removeTaskTag(workspaceId, spaceId, listId, taskId, tag.id)
      )
    );
    load();
  }

  async function handleCreateTag(name: string) {
    const res = await createTag(workspaceId, name);
    if ("tag" in res) {
      await addTaskTag(workspaceId, spaceId, listId, taskId, res.tag.id);
      setTagSearch("");
      load();
    }
  }

  async function handleDeleteTag() {
    if (!deleteTagTarget) {
      return;
    }
    await deleteTag(workspaceId, deleteTagTarget.id);
    setDeleteTagTarget(null);
    load();
  }

  async function handleToggleWatch() {
    await toggleWatcher(workspaceId, spaceId, listId, taskId);
    load();
  }

  async function handleAddChecklist() {
    if (!newChecklistName.trim()) {
      return;
    }
    await createChecklist(
      workspaceId,
      spaceId,
      listId,
      taskId,
      newChecklistName
    );
    setNewChecklistName("");
    setAddingChecklist(false);
    load();
  }

  async function handleToggleItem(itemId: string) {
    await toggleChecklistItem(workspaceId, spaceId, listId, itemId);
    load();
  }

  async function handleAddItem(checklistId: string) {
    const text = newItemTexts[checklistId] ?? "";
    if (!text.trim()) {
      return;
    }
    await addChecklistItem(workspaceId, spaceId, listId, checklistId, text);
    setNewItemTexts((prev) => ({ ...prev, [checklistId]: "" }));
    load();
  }

  async function handleDuplicate() {
    setSaving(true);
    const res = await duplicateTask(workspaceId, spaceId, listId, taskId);
    setSaving(false);
    if ("taskId" in res) {
      flashDuplicatedTask(res.taskId);
    }
    router.push(backUrl);
  }

  async function handleArchive() {
    await archiveTask(workspaceId, spaceId, listId, taskId);
    router.push(backUrl);
    toastWithUndo("Task archived", async () => {
      await unarchiveTask(workspaceId, spaceId, listId, taskId);
      router.refresh();
    });
  }

  function handleDelete() {
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    setDeleting(true);
    await deleteTask(workspaceId, spaceId, listId, taskId);
    setDeleting(false);
    router.push(backUrl);
  }

  async function confirmDeleteSubtask() {
    if (!deletingSubtask) {
      return;
    }
    setDeletingSubtaskBusy(true);
    await deleteTask(workspaceId, spaceId, listId, deletingSubtask.id);
    setDeletingSubtaskBusy(false);
    setDeletingSubtask(null);
    load();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/${workspaceId}/task/${taskId}`
      );
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  async function handleFileUpload(file: File) {
    setUploadingFile(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/tasks/${taskId}/attachments`, {
      method: "POST",
      body: fd,
    });
    setUploadingFile(false);
    if (res.ok) {
      const { attachment } = await res.json();
      setAttachments((prev) => [...prev, attachment]);
    }
  }

  // Upload several files by reusing the single-file flow above (same API,
  // validation, permissions, activity log and notifications).
  async function handleFilesUpload(files: FileList | File[] | null) {
    if (!files) {
      return;
    }
    for (const file of Array.from(files)) {
      await handleFileUpload(file);
    }
  }

  // Only react to real file drags — never to the app's dnd-kit card dragging
  // (which uses pointer events and carries no `Files` dataTransfer type).
  function isFileDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer?.types ?? []).includes("Files");
  }

  function handleAttachmentDragEnter(e: React.DragEvent) {
    if (!isFileDrag(e)) {
      return;
    }
    e.preventDefault();
    attachmentDragDepth.current += 1;
    setAttachmentDragOver(true);
  }

  function handleAttachmentDragOver(e: React.DragEvent) {
    if (!isFileDrag(e)) {
      return;
    }
    e.preventDefault(); // required to allow the drop
  }

  function handleAttachmentDragLeave(e: React.DragEvent) {
    if (!isFileDrag(e)) {
      return;
    }
    attachmentDragDepth.current = Math.max(0, attachmentDragDepth.current - 1);
    if (attachmentDragDepth.current === 0) {
      setAttachmentDragOver(false);
    }
  }

  function handleAttachmentDrop(e: React.DragEvent) {
    if (!isFileDrag(e)) {
      return;
    }
    e.preventDefault();
    attachmentDragDepth.current = 0;
    setAttachmentDragOver(false);
    void handleFilesUpload(e.dataTransfer.files);
  }

  async function handleDeleteAttachment(attachmentId: string) {
    await fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" });
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  }

  // Task-level file attachments (excludes comment attachments and inline images).
  const visibleAttachments = attachments.filter(
    (a) => !a.commentId && !a.isInline
  );

  return (
    <AttachmentPreviewProvider>
      <div className="flex h-full flex-col overflow-hidden bg-background">
        {/* Top bar */}
        <div className="flex items-center gap-3 border-b px-5 py-3 shrink-0">
          <button
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => router.push(backUrl)}
          >
            <ArrowLeftIcon className="size-4" />
          </button>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ClipboardTextIcon className="size-4" />
            <button
              className="hover:text-foreground transition-colors"
              onClick={() => router.push(listBackUrl)}
            >
              {contextLabel}
            </button>
            {parentTask && (
              <>
                <CaretRightIcon className="size-3.5" />
                <button
                  className="hover:text-foreground transition-colors truncate max-w-xs"
                  onClick={() =>
                    router.push(`/${workspaceId}/task/${parentTask.id}`)
                  }
                >
                  {parentTask.title}
                </button>
              </>
            )}
            <CaretRightIcon className="size-3.5" />
            <span className="text-foreground font-medium truncate max-w-xs">
              {t.title}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                isPinned
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              onClick={handleTogglePin}
              title={isPinned ? "Unpin from sidebar" : "Pin to sidebar"}
            >
              <PushPinIcon
                className="size-3.5"
                weight={isPinned ? "fill" : "regular"}
              />
              {isPinned ? "Pinned" : "Pin"}
            </button>
            <button
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={() => void copyLink()}
            >
              <LinkIcon className="size-3.5" /> Copy link
            </button>
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                isWatching
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              onClick={handleToggleWatch}
            >
              {isWatching ? (
                <EyeSlashIcon className="size-3.5" />
              ) : (
                <EyeIcon className="size-3.5" />
              )}
              {isWatching ? "Unwatch" : "Watch"}
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex size-7 items-center justify-center rounded-md hover:bg-accent text-muted-foreground">
                  <DotsThreeIcon className="size-4.5" weight="bold" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-1">
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                  disabled={saving}
                  onClick={handleDuplicate}
                >
                  <CopyIcon className="size-3.5 text-muted-foreground" />{" "}
                  Duplicate
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={handleArchive}
                >
                  <ArchiveIcon className="size-3.5 text-muted-foreground" />{" "}
                  Archive
                </button>
                {canPinToList && listId && (
                  <>
                    <Separator className="my-1" />
                    {data?.task.isPinnedToList ? (
                      <button
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                        onClick={async () => {
                          const res = await fetch(
                            `/api/tasks/${taskId}/pin-to-list`,
                            { method: "DELETE" }
                          );
                          if (res.ok) {
                            load();
                          }
                        }}
                      >
                        <PushPinIcon
                          className="size-3.5 text-primary"
                          weight="fill"
                        />{" "}
                        Unpin from list
                      </button>
                    ) : (
                      <button
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                        onClick={async () => {
                          const res = await fetch(
                            `/api/tasks/${taskId}/pin-to-list`,
                            { method: "POST" }
                          );
                          if (res.ok) {
                            load();
                          } else {
                            const d = await res.json().catch(() => ({}));
                            alert(d.error ?? "Failed to pin");
                          }
                        }}
                      >
                        <PushPinIcon className="size-3.5 text-muted-foreground" />{" "}
                        Pin to list top
                      </button>
                    )}
                  </>
                )}
                <Separator className="my-1" />
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                  onClick={handleDelete}
                >
                  <TrashIcon className="size-3.5" /> Delete
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* ── Left: main content ── */}
          <div className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
            {/* Title */}
            {titleEditing ? (
              // Textarea (not a single-line input) so a long title keeps the
              // same big font AND wraps across lines while editing, matching the
              // rendered heading. It auto-grows to fit; Enter still saves.
              <textarea
                autoFocus
                className="mb-5 -mx-1 block w-full resize-none overflow-hidden rounded bg-transparent px-1 py-1 text-2xl font-bold leading-tight outline-none"
                onBlur={saveTitle}
                onChange={(e) => {
                  setTitleDraft(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveTitle();
                  }
                  if (e.key === "Escape") {
                    setTitleEditing(false);
                  }
                }}
                ref={(el) => {
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }
                }}
                rows={1}
                value={titleDraft}
              />
            ) : (
              <h1
                className="text-2xl font-bold cursor-text hover:bg-accent/50 rounded px-1 -mx-1 py-1 mb-5 transition-colors"
                onClick={() => setTitleEditing(true)}
              >
                {t.title}
              </h1>
            )}

            {/* Fields grid */}
            <div className="rounded-lg border bg-card px-4 mb-6">
              {/* Status */}
              <FieldRow
                icon={
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: currentStatus?.color ?? "#9CA3AF",
                    }}
                  />
                }
                label="Status"
              >
                <Popover
                  onOpenChange={setStatusPopoverOpen}
                  open={statusPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <button
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: `${currentStatus?.color ?? "#9CA3AF"}20`,
                        color: currentStatus?.color ?? "#9CA3AF",
                      }}
                    >
                      {currentStatus?.name ?? "No status"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-52 p-0">
                    <div
                      className="max-h-60 overflow-y-auto p-1"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {(["OPEN", "ACTIVE", "CLOSED"] as const).map((type) => {
                        const group = statuses.filter((s) => s.type === type);
                        if (group.length === 0) {
                          return null;
                        }
                        const label =
                          type === "OPEN"
                            ? "Not started"
                            : type === "ACTIVE"
                              ? "Active"
                              : "Closed";
                        return (
                          <div key={type}>
                            <div className="flex items-center px-2 pt-2 pb-0.5">
                              <span className="flex-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {label}
                              </span>
                              {canPinToList && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      className="flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <DotsThreeIcon
                                        className="size-3.5"
                                        weight="bold"
                                      />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="start"
                                    className="w-36"
                                    side="right"
                                  >
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setStatusPopoverOpen(false);
                                        setManageStatusesOpen(true);
                                      }}
                                    >
                                      <GearIcon className="size-3.5" />
                                      Edit statuses
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            {group.map((s) => (
                              <button
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                                key={s.id}
                                onClick={() => handleStatusChange(s.id)}
                              >
                                <span
                                  className="size-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: s.color }}
                                />
                                <span className="flex-1 text-left">
                                  {s.name}
                                </span>
                                {s.id === t.statusId && (
                                  <CheckIcon className="size-3.5 text-primary" />
                                )}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </FieldRow>

              {/* Assignees */}
              <FieldRow
                icon={<UserIcon className="size-3.5" />}
                label="Assignees"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  {assignees.map((a) => (
                    <div
                      className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs"
                      key={a.userId}
                    >
                      <Avatar className="size-4">
                        <AvatarFallback className="text-[8px]">
                          {userInitials(a.name, a.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{a.name ?? a.email}</span>
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => handleToggleAssignee(a.userId)}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  ))}
                  <Popover
                    onOpenChange={setAssigneePopoverOpen}
                    open={assigneePopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <button className="flex size-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                        <PlusIcon className="size-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-52 p-2">
                      <p className="text-xs text-muted-foreground px-1 mb-1.5">
                        Select members
                      </p>
                      <div className="space-y-0.5 max-h-48 overflow-y-auto">
                        {members.map((m) => {
                          const selected = assignees.some(
                            (a) => a.userId === m.userId
                          );
                          return (
                            <button
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                              key={m.userId}
                              onClick={() => handleToggleAssignee(m.userId)}
                            >
                              <Avatar className="size-6 shrink-0">
                                <AvatarFallback className="text-2xs">
                                  {userInitials(m.name, m.email)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="flex-1 truncate text-left">
                                {m.name}
                              </span>
                              {selected && (
                                <CheckIcon className="size-3.5 text-primary shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <Separator className="my-1.5" />
                      <button
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() => {
                          setAssigneePopoverOpen(false);
                          setInviteOpen(true);
                        }}
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border">
                          <UserPlusIcon className="size-3.5" />
                        </span>
                        <span className="flex-1 truncate text-left">
                          Invite member
                        </span>
                      </button>
                    </PopoverContent>
                  </Popover>
                </div>
              </FieldRow>

              {/* Dates */}
              <FieldRow
                icon={<CalendarBlankIcon className="size-3.5" />}
                label="Dates"
              >
                <div className="flex items-center gap-2">
                  <Popover onOpenChange={setStartCalOpen} open={startCalOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs w-32 hover:bg-accent transition-colors">
                        <CalendarBlankIcon className="size-3 text-muted-foreground shrink-0" />
                        <span
                          className={
                            dueDateStart
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          {dueDateStart
                            ? format(dueDateStart, "MMM d, yyyy")
                            : "Start date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        onSelect={(date) => {
                          handleDueDateChange("start", date ?? null);
                          setStartCalOpen(false);
                        }}
                        selected={dueDateStart ?? undefined}
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground text-xs">→</span>
                  <Popover onOpenChange={setEndCalOpen} open={endCalOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs w-32 hover:bg-accent transition-colors">
                        <CalendarBlankIcon className="size-3 text-muted-foreground shrink-0" />
                        <span
                          className={
                            dueDateEnd
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          {dueDateEnd
                            ? format(dueDateEnd, "MMM d, yyyy")
                            : "End date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        disabled={
                          dueDateStart ? { before: dueDateStart } : undefined
                        }
                        mode="single"
                        onSelect={(date) => {
                          handleDueDateChange("end", date ?? null);
                          setEndCalOpen(false);
                        }}
                        selected={dueDateEnd ?? undefined}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </FieldRow>

              {/* Priority */}
              <FieldRow
                icon={<FlagIcon className="size-3.5" />}
                label="Priority"
              >
                <Popover
                  onOpenChange={setPriorityPopoverOpen}
                  open={priorityPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80",
                        priority.bg,
                        priority.color
                      )}
                    >
                      <span>{priority.icon}</span>
                      {priority.label}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-44 p-1">
                    {(
                      Object.entries(PRIORITY_CONFIG) as [
                        Priority,
                        (typeof PRIORITY_CONFIG)[Priority],
                      ][]
                    ).map(([key, cfg]) => (
                      <button
                        className={cn(
                          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent",
                          cfg.color
                        )}
                        key={key}
                        onClick={() => handlePriorityChange(key)}
                      >
                        <span>{cfg.icon}</span>
                        <span className="flex-1 text-left">{cfg.label}</span>
                        {key === t.priority && (
                          <CheckIcon className="size-3.5 shrink-0" />
                        )}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </FieldRow>

              {/* Tags */}
              <FieldRow icon={<TagIcon className="size-3.5" />} label="Tags">
                <div className="flex flex-wrap items-center gap-1.5">
                  {tags.map((tag) => (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      key={tag.id}
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                      }}
                    >
                      {tag.name}
                      <button
                        className="opacity-60 hover:opacity-100"
                        onClick={() => handleToggleTag(tag.id)}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  ))}
                  <Popover
                    onOpenChange={setTagPopoverOpen}
                    open={tagPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <button className="flex size-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                        <PlusIcon className="size-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-52 p-2">
                      <Input
                        autoFocus
                        className="h-7 text-xs mb-2"
                        onChange={(e) => setTagSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            tagSearch.trim() &&
                            !exactTagMatch
                          ) {
                            e.preventDefault();
                            handleCreateTag(tagSearch.trim());
                          }
                        }}
                        placeholder="Search or create…"
                        value={tagSearch}
                      />
                      <div className="space-y-0.5 max-h-40 overflow-y-auto">
                        {filteredTags.map((tag) => {
                          const selected = tags.some((t) => t.id === tag.id);
                          return (
                            <div
                              className="group/tag flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                              key={tag.id}
                            >
                              <button
                                className="flex flex-1 min-w-0 items-center gap-2"
                                onClick={() => handleToggleTag(tag.id)}
                              >
                                <span
                                  className="size-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: tag.color }}
                                />
                                <span className="flex-1 truncate text-left text-xs">
                                  {tag.name}
                                </span>
                                {selected && (
                                  <CheckIcon className="size-3.5 text-primary shrink-0" />
                                )}
                              </button>
                              <button
                                className="opacity-0 group-hover/tag:opacity-100 flex size-5 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive transition-opacity shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTagTarget({
                                    id: tag.id,
                                    name: tag.name,
                                  });
                                }}
                              >
                                <TrashIcon className="size-3" />
                              </button>
                            </div>
                          );
                        })}
                        {tagSearch && !exactTagMatch && (
                          <button
                            className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs text-primary hover:bg-accent"
                            onClick={() => handleCreateTag(tagSearch.trim())}
                          >
                            <PlusIcon className="size-3.5" /> Create &ldquo;
                            {tagSearch}&rdquo;
                          </button>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {tags.length > 1 && (
                    <button
                      className="ml-0.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
                      onClick={handleClearAllTags}
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </FieldRow>

              {/* Custom fields */}
              {customFields.map((field) => (
                <FieldRow
                  icon={<span className="size-3 shrink-0" />}
                  key={field.id}
                  label={field.name}
                >
                  <CustomFieldEditor
                    disabled={!canEdit}
                    field={field}
                    members={members}
                    onChange={(value) => handleCustomFieldChange(field.id, value)}
                    value={customFieldValues[field.id]}
                  />
                </FieldRow>
              ))}
            </div>

            {/* Description */}
            <div className="mb-6">
              <TaskDescriptionEditor
                onChange={setDescDraft}
                onSave={saveDescription}
                spaceId={spaceId}
                taskId={taskId}
                value={descDraft}
                workspaceId={workspaceId}
              />
            </div>

            {/* Unified content sections — sections with data open together on
              load; empty sections start collapsed and auto-collapse on an
              outside click. Inputs appear only after clicking "+ Add". */}
            <div className="mb-6" ref={sectionsRef}>
              <Accordion
                onValueChange={setOpenSections}
                type="multiple"
                value={openSections}
              >
                {/* Subtasks — only shown on parent tasks (not subtask detail pages) */}
                {!t.parentTaskId && (
                  <AccordionItem value="subtasks">
                    <AccordionTrigger className="hover:no-underline">
                      <SectionHeader
                        count={subtasks?.length ?? 0}
                        description="Split this work into smaller tasks."
                        icon={ListTree}
                        title="Subtasks"
                      />
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      {subtasks && subtasks.length > 0 ? (
                        <>
                          <Progress
                            className="h-1.5"
                            value={Math.round(
                              (subtasks.filter((s) => s.statusType === "CLOSED")
                                .length /
                                subtasks.length) *
                                100
                            )}
                          />
                          {(() => {
                            const renderRow = (
                              sub: (typeof subtasks)[number]
                            ) => (
                              <div
                                className="flex items-baseline gap-2 rounded-md border bg-card px-3 py-2 hover:bg-accent/30 cursor-pointer group"
                                key={sub.id}
                                onClick={() =>
                                  router.push(`/${workspaceId}/task/${sub.id}`)
                                }
                              >
                                {/* `self-center`: this row aligns by text
                                    baseline (below) so the mono seq number and
                                    the title sit on the same line, not just
                                    the same centered box — but a plain glyph-
                                    less dot/icon has no baseline of its own,
                                    so it opts back into simple centering. */}
                                <span
                                  className="size-2.5 shrink-0 self-center rounded-full"
                                  style={{
                                    backgroundColor:
                                      sub.statusColor ?? "#9CA3AF",
                                  }}
                                />
                                <span className="font-mono text-xs text-muted-foreground shrink-0">
                                  #{sub.seqNumber}
                                </span>
                                <span
                                  className={cn(
                                    "flex-1 text-sm truncate",
                                    sub.statusType === "CLOSED" &&
                                      "line-through text-muted-foreground"
                                  )}
                                >
                                  {sub.title}
                                </span>
                                <button
                                  className="flex size-6 shrink-0 self-center items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingSubtask({
                                      id: sub.id,
                                      title: sub.title,
                                    });
                                  }}
                                  title="Delete subtask"
                                  type="button"
                                >
                                  <TrashIcon className="size-3.5" />
                                </button>
                                <CaretRightIcon className="size-3.5 shrink-0 self-center text-muted-foreground opacity-0 group-hover:opacity-100" />
                              </div>
                            );
                            const active = subtasks.filter(
                              (s) => s.statusType !== "CLOSED"
                            );
                            const completed = subtasks.filter(
                              (s) => s.statusType === "CLOSED"
                            );
                            return (
                              <div className="space-y-1">
                                {active.map(renderRow)}
                                {completed.length > 0 && (
                                  <>
                                    <button
                                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                      onClick={() =>
                                        setCompletedOpen((o) => !o)
                                      }
                                      type="button"
                                    >
                                      {completedOpen ? (
                                        <CaretDownIcon className="size-3.5 shrink-0" />
                                      ) : (
                                        <CaretRightIcon className="size-3.5 shrink-0" />
                                      )}
                                      Completed ({completed.length})
                                    </button>
                                    {completedOpen && completed.map(renderRow)}
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        !addingSubtask && (
                          <p className="text-sm text-muted-foreground">
                            Break this task into smaller pieces.
                          </p>
                        )
                      )}

                      {addingSubtask ? (
                        <div className="flex gap-2 items-center">
                          <Input
                            autoFocus
                            className="h-8 rounded-lg text-xs"
                            disabled={creatingSubtask}
                            onChange={(e) => setSubtaskInput(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter" && subtaskInput.trim()) {
                                setCreatingSubtask(true);
                                await createSubtask(
                                  workspaceId,
                                  spaceId,
                                  taskId,
                                  subtaskInput.trim()
                                );
                                setSubtaskInput("");
                                setCreatingSubtask(false);
                                load();
                                subtaskInputRef.current?.focus();
                              }
                              if (e.key === "Escape") {
                                setSubtaskInput("");
                                setAddingSubtask(false);
                              }
                            }}
                            placeholder="Subtask name…"
                            ref={subtaskInputRef}
                            value={subtaskInput}
                          />
                          <Button
                            className="h-8 rounded-lg text-xs shrink-0"
                            disabled={creatingSubtask}
                            onClick={() => {
                              setSubtaskInput("");
                              setAddingSubtask(false);
                            }}
                            size="sm"
                            variant="ghost"
                          >
                            Cancel
                          </Button>
                          <Button
                            className="h-8 rounded-lg text-xs font-semibold shrink-0 px-3"
                            disabled={creatingSubtask || !subtaskInput.trim()}
                            onClick={async () => {
                              if (!subtaskInput.trim()) {
                                return;
                              }
                              setCreatingSubtask(true);
                              await createSubtask(
                                workspaceId,
                                spaceId,
                                taskId,
                                subtaskInput.trim()
                              );
                              setSubtaskInput("");
                              setCreatingSubtask(false);
                              load();
                              subtaskInputRef.current?.focus();
                            }}
                            size="sm"
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          onClick={() => setAddingSubtask(true)}
                          type="button"
                        >
                          <PlusIcon className="size-4" />
                          Add subtask
                        </button>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Dependencies */}
                <AccordionItem value="dependencies">
                  <AccordionTrigger className="hover:no-underline">
                    <SectionHeader
                      count={blockedBy.length + blocks.length}
                      description="Link tasks that block or depend on this one."
                      icon={GitBranch}
                      title="Dependencies"
                    />
                  </AccordionTrigger>
                  <AccordionContent>
                    <TaskDependencies
                      blockedBy={blockedBy}
                      blocks={blocks}
                      canEdit={canEdit}
                      hideHeader
                      listId={listId}
                      onChanged={load}
                      spaceId={spaceId}
                      taskId={taskId}
                      workspaceId={workspaceId}
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* Checklist */}
                <AccordionItem value="checklist">
                  <AccordionTrigger className="hover:no-underline">
                    <SectionHeader
                      count={totalItems}
                      description="Break this task into small actionable steps."
                      icon={ListChecks}
                      title="Checklist"
                    />
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    {checklists.length > 0 ? (
                      <div className="space-y-5">
                        {totalItems > 0 && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-8 text-right">
                              {checkProgress}%
                            </span>
                            <Progress
                              className="flex-1 h-1.5"
                              value={checkProgress}
                            />
                          </div>
                        )}
                        {checklists.map((cl) => (
                          <div key={cl.id}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-sm flex-1">
                                {cl.name}
                              </span>
                              <button
                                className="text-muted-foreground hover:text-destructive"
                                onClick={async () => {
                                  await deleteChecklist(
                                    workspaceId,
                                    spaceId,
                                    listId,
                                    cl.id
                                  );
                                  load();
                                }}
                              >
                                <XIcon className="size-3.5" />
                              </button>
                            </div>
                            <div className="space-y-1 mb-2">
                              {cl.items.map((item) => (
                                <div
                                  className="flex items-center gap-2 rounded-md py-1 px-1 hover:bg-accent/30 group"
                                  key={item.id}
                                >
                                  <Checkbox
                                    checked={item.isChecked}
                                    className="shrink-0"
                                    onCheckedChange={() =>
                                      handleToggleItem(item.id)
                                    }
                                  />
                                  <span
                                    className={cn(
                                      "flex-1 text-sm",
                                      item.isChecked &&
                                        "line-through text-muted-foreground"
                                    )}
                                  >
                                    {item.title}
                                  </span>
                                  <button
                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                    onClick={async () => {
                                      await deleteChecklistItem(
                                        workspaceId,
                                        spaceId,
                                        listId,
                                        item.id
                                      );
                                      load();
                                    }}
                                  >
                                    <XIcon className="size-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Input
                                className="h-7 rounded-lg text-xs"
                                onChange={(e) =>
                                  setNewItemTexts((prev) => ({
                                    ...prev,
                                    [cl.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleAddItem(cl.id);
                                  }
                                }}
                                placeholder="Add item…"
                                value={newItemTexts[cl.id] ?? ""}
                              />
                              <Button
                                className="h-7 rounded-lg px-3 text-xs font-semibold"
                                onClick={() => handleAddItem(cl.id)}
                                size="sm"
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      !addingChecklist && (
                        <p className="text-sm text-muted-foreground">
                          Track quick steps for this task.
                        </p>
                      )
                    )}

                    {addingChecklist ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          autoFocus
                          className="h-7 rounded-lg text-xs w-44"
                          onChange={(e) => setNewChecklistName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleAddChecklist();
                            }
                            if (e.key === "Escape") {
                              setAddingChecklist(false);
                            }
                          }}
                          placeholder="Checklist name…"
                          value={newChecklistName}
                        />
                        <Button
                          className="h-7 rounded-lg px-3 text-xs font-semibold"
                          onClick={handleAddChecklist}
                          size="sm"
                        >
                          Add
                        </Button>
                        <Button
                          className="h-7 rounded-lg text-xs"
                          onClick={() => setAddingChecklist(false)}
                          size="sm"
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        onClick={() => setAddingChecklist(true)}
                        type="button"
                      >
                        <PlusIcon className="size-4" />
                        Add checklist
                      </button>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Time Tracking */}
                <AccordionItem value="timeTracking">
                  <AccordionTrigger className="hover:no-underline">
                    <SectionHeader
                      count={timeEntries.length}
                      description="Track time spent on this task."
                      icon={Timer}
                      title="Time Tracking"
                    />
                  </AccordionTrigger>
                  <AccordionContent>
                    <TaskTimeTracking
                      canEdit={canEdit}
                      currentUserId={currentUserId}
                      entries={timeEntries}
                      hideHeader
                      listId={listId}
                      onChanged={load}
                      spaceId={spaceId}
                      taskId={taskId}
                      workspaceId={workspaceId}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <Separator className="mb-6" />

            {/* Attachments */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PaperclipIcon className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Attachments</h3>
                  {visibleAttachments.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {visibleAttachments.length} file
                      {visibleAttachments.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                {/* Hidden while empty — the large drop zone below is the only
                  call-to-action. Returns once the first file is uploaded. */}
                {visibleAttachments.length > 0 && (
                  <button
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground border hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                    disabled={uploadingFile}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <PlusIcon className="size-3.5" />
                    {uploadingFile ? "Uploading…" : "Add attachment"}
                  </button>
                )}
                {/* Always mounted — the drop zone and both buttons use this ref. */}
                <input
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file);
                      e.target.value = "";
                    }
                  }}
                  ref={fileInputRef}
                  type="file"
                />
              </div>

              {/* Drop zone — always rendered. Clicking anywhere opens the file
                picker; dragging files in shows a drop overlay. Uses the same
                upload flow as the "Add attachment" button. */}
              <div
                aria-label="Add attachments — click to browse or drop files here"
                className={cn(
                  "relative rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  attachmentDragOver
                    ? "border-primary bg-primary/5"
                    : "border-border/50 hover:border-primary/40 hover:bg-accent/30",
                  visibleAttachments.length === 0 && "min-h-40"
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleAttachmentDragEnter}
                onDragLeave={handleAttachmentDragLeave}
                onDragOver={handleAttachmentDragOver}
                onDrop={handleAttachmentDrop}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {visibleAttachments.length > 0 ? (
                  <div
                    className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {visibleAttachments.map((att) => (
                      <TaskAttachmentCard
                        att={att}
                        key={att.id}
                        onDelete={handleDeleteAttachment}
                      />
                    ))}
                    <button
                      className="flex flex-col items-center justify-center h-full min-h-24 rounded-md border-2 border-dashed border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-50"
                      disabled={uploadingFile}
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      <PlusIcon className="size-5" />
                      <span className="text-2xs mt-1">
                        {uploadingFile ? "Uploading…" : "Add file"}
                      </span>
                    </button>
                  </div>
                ) : (
                  /* Empty state — hidden as soon as one attachment exists */
                  <div className="flex flex-col items-center justify-center py-8 text-center select-none pointer-events-none">
                    <PaperclipIcon className="size-6 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium text-foreground">
                      Attachments
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {uploadingFile ? "Uploading…" : "Drag & drop files here"}
                    </p>
                    {!uploadingFile && (
                      <p className="text-sm text-muted-foreground">
                        or click anywhere to upload
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground/70">
                      Supports images, PDFs, documents, and other supported
                      files.
                    </p>
                  </div>
                )}

                {/* Drag overlay — pointer-events-none so the drop lands on the zone */}
                {attachmentDragOver && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-primary/10 backdrop-blur-[1px]">
                    <PaperclipIcon className="size-6 text-primary" />
                    <p className="mt-2 text-sm font-semibold text-primary">
                      Drop files here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Release to upload
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: activity ── */}
          <div className="w-80 xl:w-96 shrink-0 border-l flex flex-col overflow-hidden">
            <div className="flex shrink-0 border-b px-5 py-2.5">
              <span className="text-xs font-medium text-foreground">
                Activity
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <TaskActivityFeed
                currentUserId={currentUserId}
                listId={listId}
                ref={feedRef}
                spaceId={spaceId}
                taskId={taskId}
                workspaceId={workspaceId}
              />
            </div>

            {/* Task seq footer */}
            <div className="border-t px-5 py-3 shrink-0">
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">#{t.seqNumber}</span> · Created{" "}
                {format(new Date(t.createdAt), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTagTarget(null);
          }
        }}
        open={!!deleteTagTarget}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete tag &ldquo;{deleteTagTarget?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the tag and remove it from every task
              in the workspace. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteTag}
            >
              Delete tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ManageStatusesDialog
        listId={listId}
        onOpenChange={setManageStatusesOpen}
        onSaved={() => fetchAll(false)}
        open={manageStatusesOpen}
        spaceId={spaceId}
        workspaceId={workspaceId}
      />
      <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <DialogContent className="sm:max-w-xs text-center">
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <TrashIcon className="size-6 text-destructive" weight="fill" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Delete Task
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              className="flex-1"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={deleting}
              onClick={confirmDelete}
              variant="destructive"
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => !open && setDeletingSubtask(null)}
        open={!!deletingSubtask}
      >
        <DialogContent className="sm:max-w-xs text-center">
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <TrashIcon className="size-6 text-destructive" weight="fill" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Delete Subtask
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {deletingSubtask
                  ? `"${deletingSubtask.title}" will be permanently deleted.`
                  : ""}{" "}
                This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              className="flex-1"
              disabled={deletingSubtaskBusy}
              onClick={() => setDeletingSubtask(null)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={deletingSubtaskBusy}
              onClick={confirmDeleteSubtask}
              variant="destructive"
            >
              {deletingSubtaskBusy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <InviteMemberModal
        onInvited={load}
        onOpenChange={setInviteOpen}
        open={inviteOpen}
        workspaceId={workspaceId}
      />
    </AttachmentPreviewProvider>
  );
}

// ─── Task attachment card ─────────────────────────────────────────────────────
// Rendered inside <AttachmentPreviewProvider> so it can open the in-app preview.

interface TaskAttachmentCardProps {
  att: {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    url: string;
  };
  onDelete: (id: string) => void;
}

function TaskAttachmentCard({ att, onDelete }: TaskAttachmentCardProps) {
  const preview = useAttachmentPreview();
  const isImg = att.mimeType.startsWith("image/");

  function fmtBytes(bytes: number) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function openPreview() {
    if (preview) {
      preview.open(att);
    } else {
      window.open(att.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="group relative rounded-md border bg-card overflow-hidden">
      {isImg ? (
        <button className="block w-full" onClick={openPreview} type="button">
          <img
            alt={att.fileName}
            className="w-full h-24 object-cover"
            src={att.url}
          />
        </button>
      ) : (
        <button
          className="flex w-full flex-col items-center justify-center gap-2 h-24 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          onClick={openPreview}
          type="button"
        >
          {att.mimeType === "application/pdf" ? (
            <FilePdfIcon className="size-8 text-red-500" />
          ) : (
            <FileIcon className="size-8" />
          )}
        </button>
      )}
      <div className="px-2 py-1.5 border-t">
        <p className="text-xs truncate font-medium">{att.fileName}</p>
        <p className="text-2xs text-muted-foreground">
          {fmtBytes(att.fileSize)}
        </p>
      </div>
      <button
        className="absolute top-1.5 right-1.5 size-6 inline-flex items-center justify-center leading-none rounded-full bg-black/70 text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-all"
        onClick={() => onDelete(att.id)}
      >
        <XIcon className="size-3.5 shrink-0" weight="bold" />
      </button>
    </div>
  );
}
