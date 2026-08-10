"use client";

import * as React from "react";
import {
  CheckIcon,
  DotsSixVerticalIcon,
  DotsThreeIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import {
  createListStatus,
  deleteListStatus,
  getListStatuses,
  reorderListStatuses,
  updateListStatus,
} from "@/app/actions/list";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_CATEGORY_OPTIONS,
  type DashboardCategory,
} from "@/lib/dashboard-category";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  restrictToVerticalAxis,
  restrictToWindowEdges,
} from "@dnd-kit/modifiers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR_OPTIONS = [
  "#6B7280", "#EF4444", "#F97316", "#EAB308",
  "#22C55E", "#14B8A6", "#3B82F6", "#8B5CF6",
  "#EC4899", "#F43F5E",
];

const DEFAULT_COLORS: Record<StatusType, string> = {
  OPEN: "#6B7280",
  ACTIVE: "#3B82F6",
  CLOSED: "#22C55E",
};

type StatusType = "OPEN" | "ACTIVE" | "CLOSED";

const GROUPS: { type: StatusType; label: string; accent: string }[] = [
  { type: "OPEN",   label: "Not started", accent: "text-base-content/60" },
  { type: "ACTIVE", label: "Active",      accent: "text-blue-500" },
  { type: "CLOSED", label: "Closed",      accent: "text-green-600" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Status {
  id: string;
  name: string;
  color: string;
  type: StatusType;
  dashboardCategory: DashboardCategory;
  orderIndex: number;
}

interface ListStatusesSettingsProps {
  workspaceId: string;
  spaceId: string;
  listId: string;
  initialStatuses: Status[];
  onStatusesChange?: (statuses: Status[]) => void;
}

// ─── Color Swatch ─────────────────────────────────────────────────────────────

function ColorSwatch({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 p-1">
      {COLOR_OPTIONS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="size-5 rounded-full flex items-center justify-center focus:outline-none"
          style={{ backgroundColor: c, boxShadow: value === c ? `0 0 0 2px white, 0 0 0 3.5px ${c}` : undefined }}
        >
          {value === c && <CheckIcon className="size-2.5 text-white" weight="bold" />}
        </button>
      ))}
    </div>
  );
}

// ─── Add Row ──────────────────────────────────────────────────────────────────

function AddRow({
  type,
  workspaceId,
  spaceId,
  listId,
  onDone,
}: {
  type: StatusType;
  workspaceId: string;
  spaceId: string;
  listId: string;
  onDone: () => void;
}) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(DEFAULT_COLORS[type]);
  const [dashboardCategory, setDashboardCategory] = React.useState<DashboardCategory>("OPEN");
  const [colorOpen, setColorOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function save() {
    if (!name.trim()) { setError("Name required"); return; }
    setLoading(true);
    const res = await createListStatus(workspaceId, spaceId, listId, { name: name.trim(), color, type, dashboardCategory });
    setLoading(false);
    if ("error" in res) { setError(res.error); return; }
    onDone();
  }

  return (
    <div className="rounded-md border border-dashed bg-base-200/20 px-3 py-2.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="size-5 rounded-full shrink-0 ring-2 ring-offset-1 ring-transparent hover:ring-border transition-all" style={{ backgroundColor: color }} />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1" align="start">
            <ColorSwatch value={color} onChange={(c) => { setColor(c); setColorOpen(false); }} />
          </PopoverContent>
        </Popover>
        <Input
          autoFocus
          placeholder="Status name"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } if (e.key === "Escape") onDone(); }}
          className="h-7 text-sm flex-1"
          disabled={loading}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <span className="text-xs text-base-content/60 shrink-0">Dashboard category</span>
        <Select value={dashboardCategory} onValueChange={(v) => setDashboardCategory(v as DashboardCategory)} disabled={loading}>
          <SelectTrigger className="h-7 w-32 text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="p-1.5">
            {DASHBOARD_CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={save} disabled={loading || !name.trim()}>
          {loading ? "Adding…" : "Add"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDone} disabled={loading}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Edit Row ─────────────────────────────────────────────────────────────────

function EditRow({
  status,
  workspaceId,
  spaceId,
  listId,
  onDone,
}: {
  status: Status;
  workspaceId: string;
  spaceId: string;
  listId: string;
  onDone: () => void;
}) {
  const [name, setName] = React.useState(status.name);
  const [color, setColor] = React.useState(status.color);
  const [type, setType] = React.useState<StatusType>(status.type);
  const [dashboardCategory, setDashboardCategory] = React.useState<DashboardCategory>(status.dashboardCategory);
  const [colorOpen, setColorOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function save() {
    if (!name.trim()) { setError("Name required"); return; }
    setLoading(true);
    const res = await updateListStatus(workspaceId, spaceId, listId, status.id, { name: name.trim(), color, type, dashboardCategory });
    setLoading(false);
    if ("error" in res) { setError(res.error); return; }
    onDone();
  }

  return (
    <div className="rounded-md border bg-base-200/20 px-3 py-2.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="size-5 rounded-full shrink-0 ring-2 ring-offset-1 ring-transparent hover:ring-border transition-all" style={{ backgroundColor: color }} />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1" align="start">
            <ColorSwatch value={color} onChange={(c) => { setColor(c); setColorOpen(false); }} />
          </PopoverContent>
        </Popover>
        <Input
          autoFocus
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } if (e.key === "Escape") onDone(); }}
          className="h-7 text-sm flex-1"
          disabled={loading}
        />
        <Select value={type} onValueChange={(v) => setType(v as StatusType)} disabled={loading}>
          <SelectTrigger className="h-7 w-32 text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="p-1.5">
            <SelectItem value="OPEN" className="text-xs">Not started</SelectItem>
            <SelectItem value="ACTIVE" className="text-xs">Active</SelectItem>
            <SelectItem value="CLOSED" className="text-xs">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <span className="text-xs text-base-content/60 shrink-0">Dashboard category</span>
        <Select value={dashboardCategory} onValueChange={(v) => setDashboardCategory(v as DashboardCategory)} disabled={loading}>
          <SelectTrigger className="h-7 w-32 text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="p-1.5">
            {DASHBOARD_CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={save} disabled={loading || !name.trim()}>
          {loading ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDone} disabled={loading}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ListStatusesSettings({
  workspaceId,
  spaceId,
  listId,
  initialStatuses,
  onStatusesChange,
}: ListStatusesSettingsProps) {
  const [statuses, setStatuses] = React.useState(initialStatuses);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [addingType, setAddingType] = React.useState<StatusType | null>(null);
  async function refresh() {
    const res = await getListStatuses(workspaceId, spaceId, listId);
    if (!("error" in res)) {
      setStatuses(res);
      onStatusesChange?.(res);
    }
  }

  async function handleDelete(statusId: string) {
    const res = await deleteListStatus(workspaceId, spaceId, listId, statusId);
    if ("error" in res) { toast.error(res.error); return; }
    await refresh();
  }

  // Persist a within-group reorder. `next` is the full list in grouped order.
  async function persistOrder(next: Status[]) {
    setStatuses(next);
    const res = await reorderListStatuses(workspaceId, spaceId, listId, next.map((s) => s.id));
    if (res && "error" in res) { toast.error(res.error); await refresh(); return; }
    onStatusesChange?.(next);
  }

  // Reorder a single status within its own type group, then rebuild the full
  // list (grouped order) so reorderListStatuses receives a clean sequence.
  function reorderWithinGroup(type: StatusType, group: Status[]) {
    return GROUPS.flatMap((g) =>
      g.type === type ? group : statuses.filter((s) => s.type === g.type),
    );
  }

  async function handleMove(statusId: string, direction: -1 | 1) {
    const status = statuses.find((s) => s.id === statusId);
    if (!status) return;
    const group = statuses.filter((s) => s.type === status.type);
    const idx = group.findIndex((s) => s.id === statusId);
    const target = idx + direction;
    if (target < 0 || target >= group.length) return;
    const newGroup = [...group];
    [newGroup[idx], newGroup[target]] = [newGroup[target], newGroup[idx]];
    await persistOrder(reorderWithinGroup(status.type, newGroup));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeStatus = statuses.find((s) => s.id === active.id);
    const overStatus = statuses.find((s) => s.id === over.id);
    // Only allow reordering within the same type group (cross-group would
    // change the status type, which isn't supported here).
    if (!activeStatus || !overStatus || activeStatus.type !== overStatus.type) return;
    const group = statuses.filter((s) => s.type === activeStatus.type);
    const oldIndex = group.findIndex((s) => s.id === active.id);
    const newIndex = group.findIndex((s) => s.id === over.id);
    void persistOrder(reorderWithinGroup(activeStatus.type, arrayMove(group, oldIndex, newIndex)));
  }

  return (
    <DndContext
      id="list-statuses-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
    >
    <div className="space-y-8 max-w-lg">
      {GROUPS.map(({ type, label, accent }) => {
        const group = statuses.filter((s) => s.type === type);
        const isAddingHere = addingType === type;

        return (
          <div key={type} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-semibold uppercase tracking-wider", accent)}>
                {label}
              </span>
              <button
                onClick={() => { setEditingId(null); setAddingType(type); }}
                className="flex size-9 items-center justify-center rounded hover:bg-base-200 text-base-content/60 hover:text-base-content transition-colors sm:size-5"
                title={`Add ${label} status`}
              >
                <PlusIcon className="size-3.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <SortableContext items={group.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {group.map((status) =>
                editingId === status.id ? (
                  <EditRow
                    key={status.id}
                    status={status}
                    workspaceId={workspaceId}
                    spaceId={spaceId}
                    listId={listId}
                    onDone={() => { setEditingId(null); refresh(); }}
                  />
                ) : (
                  <SortableStatusRow
                    key={status.id}
                    status={status}
                    onEdit={() => { setAddingType(null); setEditingId(status.id); }}
                    onMoveUp={() => handleMove(status.id, -1)}
                    onMoveDown={() => handleMove(status.id, 1)}
                    onDelete={() => handleDelete(status.id)}
                  />
                )
              )}
              </SortableContext>

              {isAddingHere ? (
                <AddRow
                  type={type}
                  workspaceId={workspaceId}
                  spaceId={spaceId}
                  listId={listId}
                  onDone={() => { setAddingType(null); refresh(); }}
                />
              ) : (
                <button
                  onClick={() => { setEditingId(null); setAddingType(type); }}
                  className="flex w-full items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-xs text-base-content/60 hover:border-base-300 hover:bg-base-200 hover:text-base-content transition-colors"
                >
                  <PlusIcon className="size-3.5" /> Add status
                </button>
              )}
            </div>
          </div>
        );
      })}

    </div>
    </DndContext>
  );
}

// ─── Sortable status row ──────────────────────────────────────────────────────

function SortableStatusRow({
  status,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  status: Status;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: status.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 rounded-md border bg-base-100 px-2 py-2 hover:bg-base-200/30 transition-colors",
        isDragging && "opacity-50",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center text-base-content/40 group-hover:text-base-content/60 transition-colors active:cursor-grabbing sm:size-4"
      >
        <DotsSixVerticalIcon className="size-4" />
      </button>
      <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
      <span className="flex-1 min-w-0 text-sm font-medium truncate">{status.name}</span>
      <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex size-9 items-center justify-center rounded hover:bg-base-200 text-base-content/60 hover:text-base-content transition-colors sm:size-6">
              <DotsThreeIcon className="size-4" weight="bold" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-36 p-1" align="end">
            <button
              onClick={onEdit}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-base-200"
            >
              <PencilSimpleIcon className="size-3.5" /> Edit
            </button>
            <button
              onClick={onMoveUp}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-base-200 text-base-content/60"
            >
              Move up
            </button>
            <button
              onClick={onMoveDown}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-base-200 text-base-content/60"
            >
              Move down
            </button>
            <div className="h-px bg-base-300 my-1" />
            <button
              onClick={onDelete}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-error hover:bg-error/10"
            >
              <TrashIcon className="size-3.5" /> Delete
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
